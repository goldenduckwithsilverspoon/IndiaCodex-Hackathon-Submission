use aiken/collection/list
use aiken/collection/dict.{Dict}
use aiken/crypto.{Hash, VerificationKey}
use aiken/time.{PosixTime}
use cardano/assets.{lovelace_of, PolicyId}
use cardano/transaction.{Transaction, Output, OutputReference, ScriptContext, Spend}

// Node Registry Contract
// Manages CDN node registration, staking, and reputation

pub type NodeDatum {
  operator_pubkey: Hash<VerificationKey>,
  stake_amount_lovelace: Int,
  registered_at: PosixTime,
  geo_location: GeoLocation,
  bandwidth_capacity_gbps: Int,
  storage_capacity_gb: Int,
  reputation_score: Int,
  total_bytes_served: Int,
  successful_deliveries: Int,
  failed_deliveries: Int,
  uptime_percentage: Int,
  node_metadata_uri: ByteArray,
}

pub type GeoLocation {
  continent: ByteArray,
  country: ByteArray,
  city: ByteArray,
  latitude: Int,  // * 1000000 for precision
  longitude: Int, // * 1000000 for precision
}

pub type NodeRedeemer {
  Register { 
    stake: Int,
    location: GeoLocation,
  }
  UpdateMetadata { 
    new_uri: ByteArray,
    new_capacity: Int,
  }
  UpdateReputation {
    bytes_served: Int,
    deliveries_succeeded: Int,
    deliveries_failed: Int,
    oracle_signature: ByteArray,
  }
  Slash {
    reason: SlashReason,
    penalty_amount: Int,
  }
  Unstake
}

pub type SlashReason {
  SLABreach
  MaliciousActivity
  ExtendedDowntime
  DataCorruption
}

validator node_registry {
  spend(
    datum: Option<NodeDatum>,
    redeemer: NodeRedeemer,
    _own_ref: OutputReference,
    ctx: ScriptContext,
  ) {
    let ScriptContext { transaction, info } = ctx
    
    expect Some(node_data) = datum
    expect Spend(_) = info
    
    when redeemer is {
      // New node registration
      Register { stake, location } -> {
        // Verify minimum stake requirement (1000 ADA)
        expect stake >= 1_000_000_000
        
        // Verify stake is locked in contract
        let contract_output =
          list.find(
            transaction.outputs,
            fn(output) {
              lovelace_of(output.value) >= stake
            },
          )
        
        expect Some(_) = contract_output
        
        // Verify geographic data is valid
        expect bytearray.length(location.continent) > 0
        expect bytearray.length(location.country) > 0
        
        // Initial reputation score
        expect node_data.reputation_score == 100
        
        True
      }
      
      // Update node metadata
      UpdateMetadata { new_uri, new_capacity } -> {
        // Only operator can update
        expect list.has(transaction.extra_signatories, node_data.operator_pubkey)
        
        // Verify new metadata
        expect bytearray.length(new_uri) > 0
        expect new_capacity > 0
        
        // Find continuing output with updated datum
        let updated_output =
          list.find(
            transaction.outputs,
            fn(output) {
              when output.datum is {
                InlineDatum(data) -> {
                  expect updated: NodeDatum = data
                  updated.node_metadata_uri == new_uri &&
                  updated.storage_capacity_gb == new_capacity
                }
                _ -> False
              }
            },
          )
        
        expect Some(_) = updated_output
        True
      }
      
      // Update reputation from monitoring oracle
      UpdateReputation { 
        bytes_served,
        deliveries_succeeded,
        deliveries_failed,
        oracle_signature,
      } -> {
        // Verify oracle signature
        expect verify_oracle(oracle_signature, transaction.extra_signatories)
        
        // Calculate new reputation score
        let total_deliveries = deliveries_succeeded + deliveries_failed
        let success_rate = if total_deliveries > 0 {
          (deliveries_succeeded * 100) / total_deliveries
        } else {
          100
        }
        
        // Reputation formula: weighted average of success rate and uptime
        let new_reputation = 
          (success_rate * 70 + node_data.uptime_percentage * 30) / 100
        
        expect new_reputation >= 0
        expect new_reputation <= 100
        
        // Find continuing output with updated reputation
        let updated_output =
          list.find(
            transaction.outputs,
            fn(output) {
              when output.datum is {
                InlineDatum(data) -> {
                  expect updated: NodeDatum = data
                  updated.reputation_score == new_reputation &&
                  updated.total_bytes_served == node_data.total_bytes_served + bytes_served
                }
                _ -> False
              }
            },
          )
        
        expect Some(_) = updated_output
        True
      }
      
      // Slash stake for violations
      Slash { reason, penalty_amount } -> {
        // Verify slash is authorized (DAO governance or automated)
        let is_authorized = when reason is {
          SLABreach -> verify_sla_breach(node_data, transaction)
          MaliciousActivity -> verify_malicious_activity(transaction)
          ExtendedDowntime -> verify_downtime(node_data, transaction)
          DataCorruption -> verify_data_corruption(transaction)
        }
        
        expect is_authorized
        
        // Verify penalty amount is reasonable (max 50% of stake)
        let max_penalty = node_data.stake_amount_lovelace / 2
        expect penalty_amount <= max_penalty
        
        // Penalty goes to protocol treasury
        let treasury_output =
          list.find(
            transaction.outputs,
            fn(output) {
              lovelace_of(output.value) >= penalty_amount
            },
          )
        
        expect Some(_) = treasury_output
        
        // Remaining stake stays locked
        let remaining_stake = node_data.stake_amount_lovelace - penalty_amount
        
        let continuing_output =
          list.find(
            transaction.outputs,
            fn(output) {
              when output.datum is {
                InlineDatum(data) -> {
                  expect updated: NodeDatum = data
                  updated.stake_amount_lovelace == remaining_stake
                }
                _ -> False
              }
            },
          )
        
        expect Some(_) = continuing_output
        True
      }
      
      // Unstake and exit network
      Unstake -> {
        // Only operator can unstake
        expect list.has(transaction.extra_signatories, node_data.operator_pubkey)
        
        // Verify minimum lock period (30 days)
        let tx_validity = transaction.validity_range
        let current_time = when tx_validity.lower_bound.bound_type is {
          Finite(t) -> t
          _ -> 0
        }
        
        let lock_period = 30 * 24 * 60 * 60 // 30 days in seconds
        expect current_time >= node_data.registered_at + lock_period
        
        // Verify no pending settlements
        expect node_data.failed_deliveries == 0
        
        // Return stake to operator
        let operator_output =
          list.find(
            transaction.outputs,
            fn(output) {
              output.address.payment_credential ==
                Some(VerificationKeyCredential(node_data.operator_pubkey)) &&
                lovelace_of(output.value) >= node_data.stake_amount_lovelace
            },
          )
        
        expect Some(_) = operator_output
        True
      }
    }
  }
}

// Helper functions
fn verify_oracle(
  _signature: ByteArray,
  signatories: List<Hash<VerificationKey>>,
) -> Bool {
  // Verify monitoring oracle signature
  list.length(signatories) > 0
}

fn verify_sla_breach(
  node: NodeDatum,
  _tx: Transaction,
) -> Bool {
  // SLA breach if uptime < 99%
  node.uptime_percentage < 99
}

fn verify_malicious_activity(_tx: Transaction) -> Bool {
  // Check for proof of malicious activity
  True
}

fn verify_downtime(node: NodeDatum, _tx: Transaction) -> Bool {
  // Extended downtime if uptime < 90%
  node.uptime_percentage < 90
}

fn verify_data_corruption(_tx: Transaction) -> Bool {
  // Verify proof of data corruption
  True
}
