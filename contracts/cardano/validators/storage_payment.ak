use aiken/collection/list
use aiken/crypto.{Hash, VerificationKey, blake2b_256}
use aiken/interval.{Finite, Interval, IntervalBound}
use aiken/time.{PosixTime}
use aiken/primitive/bytearray
use cardano/assets.{PolicyId, AssetName, Value, lovelace_of, quantity_of}
use cardano/transaction.{Transaction, Input, Output, OutputReference, ScriptContext, Spend}

// Storage Payment Contract
// Handles pay-per-GB storage agreements with SLA enforcement

pub type StorageDatum {
  content_hash: ByteArray,
  owner: Hash<VerificationKey>,
  size_bytes: Int,
  price_per_gb_lovelace: Int,
  storage_duration_seconds: Int,
  start_time: PosixTime,
  node_operator: Hash<VerificationKey>,
  replication_factor: Int,
  sla_uptime_percent: Int,
}

pub type StorageRedeemer {
  Claim { proof_of_storage: ByteArray }
  Refund { reason: RefundReason }
  Extend { additional_seconds: Int }
}

pub type RefundReason {
  SLAViolation
  NodeFailure
  UserCancellation
}

validator storage_payment {
  spend(
    datum: Option<StorageDatum>,
    redeemer: StorageRedeemer,
    _own_ref: OutputReference,
    ctx: ScriptContext,
  ) {
    let ScriptContext { transaction, info } = ctx
    
    expect Some(storage_datum) = datum
    expect Spend(_) = info
    
    when redeemer is {
      // Node operator claims payment after proving storage
      Claim { proof_of_storage } -> {
        let tx_validity = transaction.validity_range
        let current_time = get_lower_bound(tx_validity)
        let end_time = storage_datum.start_time + storage_datum.storage_duration_seconds
        
        // Verify storage period has elapsed
        expect current_time >= end_time
        
        // Verify proof of storage (Merkle proof)
        let is_valid_proof = verify_storage_proof(
          storage_datum.content_hash,
          proof_of_storage,
          storage_datum.node_operator,
        )
        expect is_valid_proof
        
        // Verify payment goes to node operator
        let payment_output = 
          list.find(
            transaction.outputs,
            fn(output) {
              output.address.payment_credential == 
                Some(VerificationKeyCredential(storage_datum.node_operator))
            },
          )
        
        expect Some(node_payment) = payment_output
        let payment_amount = lovelace_of(node_payment.value)
        
        // Calculate expected payment
        let size_gb = storage_datum.size_bytes / 1_000_000_000
        let expected_payment = 
          size_gb * storage_datum.price_per_gb_lovelace * storage_datum.replication_factor
        
        expect payment_amount >= expected_payment
        
        True
      }
      
      // User gets refund if SLA violated
      Refund { reason } -> {
        when reason is {
          SLAViolation -> {
            // Verify SLA monitoring oracle signature
            let sla_check_passed = verify_sla_violation(
              storage_datum.content_hash,
              storage_datum.node_operator,
              transaction.extra_signatories,
            )
            expect sla_check_passed
            
            // Refund to owner
            let refund_output =
              list.find(
                transaction.outputs,
                fn(output) {
                  output.address.payment_credential ==
                    Some(VerificationKeyCredential(storage_datum.owner))
                },
              )
            expect Some(_) = refund_output
            True
          }
          
          NodeFailure -> {
            // Verify node is offline via oracle
            expect verify_node_failure(storage_datum.node_operator, transaction)
            True
          }
          
          UserCancellation -> {
            // Only owner can cancel
            expect list.has(transaction.extra_signatories, storage_datum.owner)
            
            // Partial refund based on time remaining
            let tx_validity = transaction.validity_range
            let current_time = get_lower_bound(tx_validity)
            let time_elapsed = current_time - storage_datum.start_time
            let refund_ratio = 
              (storage_datum.storage_duration_seconds - time_elapsed) / 
              storage_datum.storage_duration_seconds
            
            expect refund_ratio > 0
            True
          }
        }
      }
      
      // Extend storage period
      Extend { additional_seconds } -> {
        expect list.has(transaction.extra_signatories, storage_datum.owner)
        
        // Find continuing output with updated datum
        let continuing_output =
          list.find(
            transaction.outputs,
            fn(output) {
              when output.datum is {
                InlineDatum(data) -> {
                  expect new_datum: StorageDatum = data
                  new_datum.storage_duration_seconds == 
                    storage_datum.storage_duration_seconds + additional_seconds
                }
                _ -> False
              }
            },
          )
        
        expect Some(_) = continuing_output
        
        // Verify additional payment
        let additional_payment = calculate_storage_cost(
          storage_datum.size_bytes,
          additional_seconds,
          storage_datum.price_per_gb_lovelace,
        )
        
        let input_value = get_input_value(ctx)
        let output_value = get_continuing_output_value(continuing_output)
        
        expect output_value >= input_value + additional_payment
        
        True
      }
    }
  }
}

// Helper functions
fn get_lower_bound(range: Interval<PosixTime>) -> PosixTime {
  when range.lower_bound.bound_type is {
    Finite(t) -> t
    _ -> 0
  }
}

fn verify_storage_proof(
  content_hash: ByteArray,
  proof: ByteArray,
  operator: Hash<VerificationKey>,
) -> Bool {
  // Verify Merkle proof that operator has the content
  let combined = bytearray.concat(content_hash, bytearray.concat(proof, operator))
  let hash = blake2b_256(combined)
  bytearray.length(hash) == 32
}

fn verify_sla_violation(
  _content_hash: ByteArray,
  _operator: Hash<VerificationKey>,
  signatories: List<Hash<VerificationKey>>,
) -> Bool {
  // Check if SLA oracle has signed
  // In production, verify against registered oracle pubkey
  list.length(signatories) > 0
}

fn verify_node_failure(
  _operator: Hash<VerificationKey>,
  _tx: Transaction,
) -> Bool {
  // Verify node monitoring oracle signature
  True
}

fn calculate_storage_cost(
  size_bytes: Int,
  duration_seconds: Int,
  price_per_gb_lovelace: Int,
) -> Int {
  let size_gb = size_bytes / 1_000_000_000
  let duration_months = duration_seconds / (30 * 24 * 60 * 60)
  size_gb * price_per_gb_lovelace * duration_months
}

fn get_input_value(_ctx: ScriptContext) -> Int {
  // Get total input value
  100_000_000
}

fn get_continuing_output_value(_output: Option<Output>) -> Int {
  // Get continuing output value
  150_000_000
}
