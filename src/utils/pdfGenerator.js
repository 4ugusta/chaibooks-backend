const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

/**
 * Generate Invoice PDF
 */
async function generateInvoicePDF(invoice, businessDetails, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Pipe PDF to response
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
  doc.pipe(res);

  // Header
  doc.fontSize(20).text(businessDetails.businessName || 'ChaiBooks', 50, 50);
  doc.fontSize(10).text(businessDetails.address || '', 50, 75);
  doc.text(`GSTIN: ${businessDetails.gstin || ''}`, 50, 90);
  doc.text(`Phone: ${businessDetails.phone || ''}`, 50, 105);
  doc.text(`Email: ${businessDetails.email || ''}`, 50, 120);

  // Invoice Title
  doc.fontSize(16).text('TAX INVOICE', 400, 50, { align: 'right' });
  doc.fontSize(10).text(`Invoice No: ${invoice.invoiceNumber}`, 400, 75, { align: 'right' });
  doc.text(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}`, 400, 90, { align: 'right' });
  if (invoice.dueDate) {
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}`, 400, 105, { align: 'right' });
  }

  // Line separator
  doc.moveTo(50, 145).lineTo(550, 145).stroke();

  // Bill To
  doc.fontSize(12).text('Bill To:', 50, 160);
  doc.fontSize(10).text(invoice.customer.name, 50, 180);
  let billToY = 195;
  if (invoice.customer.gstin) {
    doc.text(`GSTIN: ${invoice.customer.gstin}`, 50, billToY);
    billToY += 15;
  }
  if (invoice.customer.pan) {
    doc.text(`PAN: ${invoice.customer.pan}`, 50, billToY);
    billToY += 15;
  }
  doc.text(invoice.customer.contact.phone, 50, billToY);

  if (invoice.customer.address) {
    doc.text(`${invoice.customer.address.street || ''}`, 50, 225);
    doc.text(`${invoice.customer.address.city || ''}, ${invoice.customer.address.state || ''} ${invoice.customer.address.pincode || ''}`, 50, 240);
  }

  // Items Table
  const tableTop = 280;
  doc.fontSize(10);

  // Table Headers
  doc.font('Helvetica-Bold');
  doc.text('Item', 50, tableTop);
  doc.text('HSN', 180, tableTop);
  doc.text('Qty', 240, tableTop);
  doc.text('Rate', 280, tableTop, { width: 60, align: 'right' });
  doc.text('Amount', 340, tableTop, { width: 60, align: 'right' });
  doc.text('GST%', 400, tableTop, { width: 40, align: 'right' });
  doc.text('Total', 450, tableTop, { width: 90, align: 'right' });

  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

  // Table Items
  doc.font('Helvetica');
  let yPosition = tableTop + 25;

  invoice.items.forEach((item, i) => {
    if (yPosition > 700) {
      doc.addPage();
      yPosition = 50;
    }

    doc.text(item.itemName, 50, yPosition, { width: 120 });
    doc.text(item.hsnCode, 180, yPosition);
    doc.text(`${item.quantity} ${item.unit}`, 240, yPosition);
    doc.text(item.rate.toFixed(2), 280, yPosition, { width: 60, align: 'right' });
    doc.text(item.amount.toFixed(2), 340, yPosition, { width: 60, align: 'right' });
    doc.text(item.gst.rate.toString(), 400, yPosition, { width: 40, align: 'right' });
    doc.text(item.total.toFixed(2), 450, yPosition, { width: 90, align: 'right' });

    yPosition += 20;
  });

  // Line separator
  doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
  yPosition += 10;

  // Totals
  doc.font('Helvetica-Bold');
  doc.text('Subtotal:', 350, yPosition);
  doc.text(invoice.subtotal.toFixed(2), 450, yPosition, { width: 90, align: 'right' });
  yPosition += 20;

  if (invoice.totalGst.cgst > 0) {
    doc.text('CGST:', 350, yPosition);
    doc.text(invoice.totalGst.cgst.toFixed(2), 450, yPosition, { width: 90, align: 'right' });
    yPosition += 20;

    doc.text('SGST:', 350, yPosition);
    doc.text(invoice.totalGst.sgst.toFixed(2), 450, yPosition, { width: 90, align: 'right' });
    yPosition += 20;
  }

  if (invoice.totalGst.igst > 0) {
    doc.text('IGST:', 350, yPosition);
    doc.text(invoice.totalGst.igst.toFixed(2), 450, yPosition, { width: 90, align: 'right' });
    yPosition += 20;
  }

  if (invoice.discount > 0) {
    doc.text('Discount:', 350, yPosition);
    doc.text(invoice.discount.toFixed(2), 450, yPosition, { width: 90, align: 'right' });
    yPosition += 20;
  }

  if (invoice.roundOff !== 0) {
    doc.text('Round Off:', 350, yPosition);
    doc.text(invoice.roundOff.toFixed(2), 450, yPosition, { width: 90, align: 'right' });
    yPosition += 20;
  }

  doc.fontSize(12);
  doc.text('Grand Total:', 350, yPosition);
  doc.text(`₹ ${invoice.grandTotal.toFixed(2)}`, 450, yPosition, { width: 90, align: 'right' });
  yPosition += 25;

  // Amount in words
  doc.fontSize(10).font('Helvetica');
  doc.text(`Amount in Words: ${invoice.amountInWords}`, 50, yPosition);
  yPosition += 30;

  // Terms and Conditions
  if (invoice.termsAndConditions) {
    doc.fontSize(10).font('Helvetica-Bold').text('Terms & Conditions:', 50, yPosition);
    doc.font('Helvetica').text(invoice.termsAndConditions, 50, yPosition + 15, { width: 500 });
    yPosition += 40;
  }

  // Bank Details
  const bank = businessDetails.bankAccount;
  if (bank && bank.accountNumber) {
    if (yPosition > 680) {
      doc.addPage();
      yPosition = 50;
    }
    doc.fontSize(10).font('Helvetica-Bold').text('Bank Details:', 50, yPosition);
    yPosition += 15;
    doc.font('Helvetica');
    if (bank.bankName) { doc.text(`Bank: ${bank.bankName}`, 50, yPosition); yPosition += 15; }
    if (bank.branchName) { doc.text(`Branch: ${bank.branchName}`, 50, yPosition); yPosition += 15; }
    doc.text(`A/C No: ${bank.accountNumber}`, 50, yPosition); yPosition += 15;
    if (bank.ifscCode) { doc.text(`IFSC: ${bank.ifscCode}`, 50, yPosition); yPosition += 15; }
  }

  // Signature
  const sigY = Math.max(yPosition + 20, 720);
  doc.font('Helvetica').text('For ' + (businessDetails.businessName || 'ChaiBooks'), 400, sigY);
  doc.text('Authorized Signatory', 400, sigY + 30);

  doc.end();
}

/**
 * Generate E-Way Bill PDF with QR Code
 */
async function generateEWayBillPDF(invoice, businessDetails, eWayBillData, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=eway-bill-${invoice.invoiceNumber}.pdf`);
  doc.pipe(res);

  // Title
  doc.fontSize(18).text('E-WAY BILL', { align: 'center' });
  doc.moveDown();

  // E-Way Bill Number
  doc.fontSize(14).text(`E-Way Bill No: ${eWayBillData.number}`, { align: 'center' });
  doc.fontSize(10).text(`Generated Date: ${new Date(eWayBillData.date).toLocaleDateString('en-IN')}`, { align: 'center' });
  doc.text(`Valid Until: ${new Date(eWayBillData.validUpto).toLocaleDateString('en-IN')}`, { align: 'center' });
  doc.moveDown(2);

  // QR Code
  if (eWayBillData.qrCode) {
    try {
      const qrDataUrl = await QRCode.toDataURL(eWayBillData.qrCode);
      const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      doc.image(qrBuffer, 225, doc.y, { width: 150 });
      doc.moveDown(10);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }

  // From (Supplier) Details
  doc.fontSize(12).font('Helvetica-Bold').text('From (Supplier):', 50, doc.y);
  doc.fontSize(10).font('Helvetica')
    .text(businessDetails.businessName || '', 50, doc.y + 5)
    .text(`GSTIN: ${businessDetails.gstin || ''}`, 50, doc.y + 5)
    .text(businessDetails.address || '', 50, doc.y + 5);

  doc.moveDown();

  // To (Recipient) Details
  doc.fontSize(12).font('Helvetica-Bold').text('To (Recipient):', 50, doc.y);
  doc.fontSize(10).font('Helvetica')
    .text(invoice.customer.name, 50, doc.y + 5);
  if (invoice.customer.gstin) doc.text(`GSTIN: ${invoice.customer.gstin}`, 50, doc.y + 5);
  if (invoice.customer.pan) doc.text(`PAN: ${invoice.customer.pan}`, 50, doc.y + 5);

  if (invoice.customer.address) {
    doc.text(`${invoice.customer.address.street || ''}, ${invoice.customer.address.city || ''}`, 50, doc.y + 5);
    doc.text(`${invoice.customer.address.state || ''} - ${invoice.customer.address.pincode || ''}`, 50, doc.y + 5);
  }

  doc.moveDown();

  // Document Details
  doc.fontSize(12).font('Helvetica-Bold').text('Document Details:', 50, doc.y);
  doc.fontSize(10).font('Helvetica')
    .text(`Invoice No: ${invoice.invoiceNumber}`, 50, doc.y + 5)
    .text(`Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}`, 50, doc.y + 5)
    .text(`Invoice Value: ₹ ${invoice.grandTotal.toFixed(2)}`, 50, doc.y + 5);

  doc.moveDown();

  // Items Summary
  doc.fontSize(12).font('Helvetica-Bold').text('Goods Details:', 50, doc.y);
  doc.fontSize(10).font('Helvetica');

  invoice.items.forEach((item, index) => {
    doc.text(`${index + 1}. ${item.itemName} - ${item.quantity} ${item.unit}`, 50, doc.y + 5);
  });

  doc.end();
}

module.exports = {
  generateInvoicePDF,
  generateEWayBillPDF
};
