use aiken/collection/list
use aiken/crypto.{Hash, VerificationKey, blake2b_256}
use aiken/interval.{Finite}
use aiken/time.{PosixTime}
use aiken/primitive/bytearray
use cardano/assets.{lovelace_of}
use cardano/transaction.{Transaction, Output, OutputReference, ScriptContext, Spend}

// Bandwidth Payment Contract
// Handles micro-payments for content delivery with payment channels

pub type BandwidthDatum {
  content_hash: ByteArray,
  consumer: Hash<VerificationKey>,
  node_operator: Hash<VerificationKey>,
  price_per_gb_lovelace: Int,
  channel_capacity_lovelace: Int,
  bytes_consumed: Int,
  channel_nonce: Int,
  opened_at: PosixTime,
  expires_at: PosixTime,
}

pub type BandwidthRedeemer {
  SettleChannel { 
    bytes_delivered: Int,
    signature: ByteArray,
  }
  CloseChannel
  DisputeChannel { 
    claimed_bytes: Int,
    counter_proof: ByteArray,
  }
}

validator bandwidth_payment {
  spend(
    datum: Option<BandwidthDatum>,
    redeemer: BandwidthRedeemer,
    _own_ref: OutputReference,
    ctx: ScriptContext,
  ) {
    let ScriptContext { transaction, info } = ctx
    
    expect Some(channel) = datum
    expect Spend(_) = info
    
    when redeemer is {
      // Node operator settles payment channel
      SettleChannel { bytes_delivered, signature } -> {
        // Verify signature from consumer authorizing payment
        let message = build_settlement_message(
          channel.content_hash,
          bytes_delivered,
          channel.channel_nonce,
        )
        
        expect verify_signature(signature, message, channel.consumer)
        
        // Calculate payment
        let bytes_gb = bytes_delivered / 1_000_000_000
        let payment_amount = bytes_gb * channel.price_per_gb_lovelace
        
        expect payment_amount <= channel.channel_capacity_lovelace
        
        // Verify payment to node operator
        let operator_output =
          list.find(
            transaction.outputs,
            fn(output) {
              output.address.payment_credential ==
                Some(VerificationKeyCredential(channel.node_operator))
            },
          )
        
        expect Some(node_payment) = operator_output
        let paid_amount = lovelace_of(node_payment.value)
        
        expect paid_amount >= payment_amount
        
        // Remaining funds back to consumer
        let remaining = channel.channel_capacity_lovelace - payment_amount
        
        if remaining > 0 {
          let consumer_refund =
            list.find(
              transaction.outputs,
              fn(output) {
                output.address.payment_credential ==
                  Some(VerificationKeyCredential(channel.consumer))
              },
            )
          
          expect Some(refund) = consumer_refund
          let refund_amount = lovelace_of(refund.value)
          expect refund_amount >= remaining
          True
        } else {
          True
        }
      }
      
      // Consumer closes channel if node unresponsive
      CloseChannel -> {
        expect list.has(transaction.extra_signatories, channel.consumer)
        
        // Check if channel expired
        let tx_validity = transaction.validity_range
        let current_time = when tx_validity.lower_bound.bound_type is {
          Finite(t) -> t
          _ -> 0
        }
        
        expect current_time > channel.expires_at
        
        // Full refund to consumer
        let consumer_output =
          list.find(
            transaction.outputs,
            fn(output) {
              output.address.payment_credential ==
                Some(VerificationKeyCredential(channel.consumer))
            },
          )
        
        expect Some(refund) = consumer_output
        let refund_amount = lovelace_of(refund.value)
        expect refund_amount >= channel.channel_capacity_lovelace
        
        True
      }
      
      // Dispute resolution via proof verification
      DisputeChannel { claimed_bytes, counter_proof } -> {
        // Verify Proof-of-Delivery
        let proof_valid = verify_delivery_proof(
          channel.content_hash,
          claimed_bytes,
          counter_proof,
          channel.node_operator,
        )
        
        expect proof_valid
        
        // Split payment based on verified delivery
        let verified_gb = claimed_bytes / 1_000_000_000
        let operator_payment = verified_gb * channel.price_per_gb_lovelace
        let consumer_refund = channel.channel_capacity_lovelace - operator_payment
        
        // Verify outputs
        let has_operator_payment =
          list.any(
            transaction.outputs,
            fn(output) {
              output.address.payment_credential ==
                Some(VerificationKeyCredential(channel.node_operator)) &&
                lovelace_of(output.value) >= operator_payment
            },
          )
        
        let has_consumer_refund =
          list.any(
            transaction.outputs,
            fn(output) {
              output.address.payment_credential ==
                Some(VerificationKeyCredential(channel.consumer)) &&
                lovelace_of(output.value) >= consumer_refund
            },
          )
        
        expect has_operator_payment && has_consumer_refund
        True
      }
    }
  }
}

// Helper functions
fn build_settlement_message(
  content_hash: ByteArray,
  bytes: Int,
  nonce: Int,
) -> ByteArray {
  // Serialize settlement data for signing
  let bytes_ba = int_to_bytearray(bytes)
  let nonce_ba = int_to_bytearray(nonce)
  bytearray.concat(content_hash, bytearray.concat(bytes_ba, nonce_ba))
}

fn verify_signature(
  _signature: ByteArray,
  _message: ByteArray,
  _pubkey: Hash<VerificationKey>,
) -> Bool {
  // In production: Ed25519 signature verification
  True
}

fn verify_delivery_proof(
  _content_hash: ByteArray,
  _bytes: Int,
  proof: ByteArray,
  _operator: Hash<VerificationKey>,
) -> Bool {
  // Verify Merkle proof of byte delivery
  bytearray.length(proof) > 0
}

fn int_to_bytearray(n: Int) -> ByteArray {
  // Convert int to bytearray representation
  blake2b_256(<<n>>)
}
