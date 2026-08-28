'use client';

import React from 'react';

interface PaymentReceiptProps {
  transactionId: string;
  productName: string;
  productPrice: number;
  razorpayPaymentId: string;
  razorpayOrderId: string;
}

export default function PaymentReceipt({
  transactionId,
  productName,
  productPrice,
  razorpayPaymentId,
  razorpayOrderId,
}: PaymentReceiptProps) {
  return (
    <div className="glass-panel p-6 rounded-xl border border-[#4ade80]/30 mt-4 bg-surface-container-low/50 relative overflow-hidden max-w-sm">
      <div className="absolute top-0 left-0 w-full h-1 bg-[#4ade80]"></div>
      
      <div className="flex flex-col items-center justify-center mb-6 pt-2">
        <div className="w-12 h-12 rounded-full bg-[#4ade80]/20 flex items-center justify-center shrink-0 mb-3 border border-[#4ade80]/30 shadow-[0_0_15px_rgba(74,222,128,0.2)]">
          <span className="material-symbols-outlined text-[#4ade80] text-[24px]">check</span>
        </div>
        <div className="font-headline-sm text-on-surface text-lg">Payment Successful</div>
        <div className="font-body-main text-on-surface-variant text-xs text-center mt-1">Your purchase has been verified and completed</div>
      </div>

      <div className="bg-surface-container-lowest/50 rounded-lg border border-outline-variant/10 overflow-hidden">
        <div className="flex justify-between items-center p-3 border-b border-outline-variant/10">
          <span className="font-label-micro uppercase tracking-widest text-on-surface-variant">Product</span>
          <span className="font-body-main text-sm text-on-surface text-right truncate ml-4" title={productName}>{productName}</span>
        </div>
        <div className="flex justify-between items-center p-3 border-b border-outline-variant/10 bg-primary/5">
          <span className="font-label-micro uppercase tracking-widest text-on-surface-variant">Amount</span>
          <span className="font-tabular-data text-primary text-lg font-bold">₹{productPrice.toLocaleString('en-IN')}</span>
        </div>
        <div className="flex justify-between items-center p-3 border-b border-outline-variant/10">
          <span className="font-label-micro uppercase tracking-widest text-on-surface-variant">Txn ID</span>
          <span className="font-tabular-data text-xs text-on-surface-variant">{transactionId.slice(0, 8)}...</span>
        </div>
        <div className="flex justify-between items-center p-3 border-b border-outline-variant/10">
          <span className="font-label-micro uppercase tracking-widest text-on-surface-variant">Order</span>
          <span className="font-tabular-data text-xs text-on-surface-variant">{razorpayOrderId}</span>
        </div>
        <div className="flex justify-between items-center p-3 border-b border-outline-variant/10">
          <span className="font-label-micro uppercase tracking-widest text-on-surface-variant">Payment</span>
          <span className="font-tabular-data text-xs text-on-surface-variant truncate ml-4" title={razorpayPaymentId}>{razorpayPaymentId}</span>
        </div>
        <div className="flex justify-between items-center p-3 border-b border-outline-variant/10">
          <span className="font-label-micro uppercase tracking-widest text-on-surface-variant">Status</span>
          <span className="font-tabular-data text-xs text-[#4ade80] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></span>
            Verified & Completed
          </span>
        </div>
        <div className="flex justify-between items-center p-3">
          <span className="font-label-micro uppercase tracking-widest text-on-surface-variant">Time</span>
          <span className="font-tabular-data text-xs text-on-surface-variant">{new Date().toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-6 text-center font-label-micro uppercase tracking-widest text-[10px] text-on-surface-variant flex items-center justify-center gap-2">
        <span className="material-symbols-outlined text-[14px]">science</span>
        TEST MODE — No real money charged
      </div>
    </div>
  );
}
