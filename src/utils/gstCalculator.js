// GST calculation utilities

/**
 * Calculate GST amounts
 * @param {Number} amount - Base amount before GST
 * @param {Number} gstRate - GST rate (5, 12, 18, 28)
 * @param {Boolean} isInterState - Whether transaction is inter-state
 * @returns {Object} GST breakdown
 */
function calculateGST(amount, gstRate, isInterState = false) {
  const gstAmount = (amount * gstRate) / 100;

  if (isInterState) {
    // Inter-state: IGST only
    return {
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      totalGst: gstAmount,
      totalAmount: amount + gstAmount
    };
  } else {
    // Intra-state: CGST + SGST
    const cgst = gstAmount / 2;
    const sgst = gstAmount / 2;
    return {
      cgst: cgst,
      sgst: sgst,
      igst: 0,
      totalGst: gstAmount,
      totalAmount: amount + gstAmount
    };
  }
}

/**
 * Calculate reverse GST (when total includes GST)
 * @param {Number} totalAmount - Total amount including GST
 * @param {Number} gstRate - GST rate
 * @returns {Object} Base amount and GST breakdown
 */
function reverseGST(totalAmount, gstRate) {
  const baseAmount = (totalAmount * 100) / (100 + gstRate);
  const gstAmount = totalAmount - baseAmount;

  return {
    baseAmount: baseAmount,
    gstAmount: gstAmount,
    gstRate: gstRate
  };
}

/**
 * Calculate invoice totals
 * @param {Array} items - Array of invoice items
 * @param {Boolean} isInterState - Whether transaction is inter-state
 * @param {Number} discount - Discount amount
 * @returns {Object} Invoice totals
 */
function calculateInvoiceTotals(items, isInterState = false, discount = 0) {
  let subtotal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  items.forEach(item => {
    const itemAmount = item.quantity * item.rate;
    subtotal += itemAmount;

    const gst = calculateGST(itemAmount, item.gst.rate, isInterState);
    totalCgst += gst.cgst;
    totalSgst += gst.sgst;
    totalIgst += gst.igst;
  });

  const totalGst = totalCgst + totalSgst + totalIgst;
  const grandTotal = subtotal + totalGst - discount;
  const roundOff = Math.round(grandTotal) - grandTotal;
  const finalTotal = Math.round(grandTotal);

  return {
    subtotal: subtotal,
    totalGst: {
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      total: totalGst
    },
    discount: discount,
    roundOff: roundOff,
    grandTotal: finalTotal
  };
}

module.exports = {
  calculateGST,
  reverseGST,
  calculateInvoiceTotals
};
