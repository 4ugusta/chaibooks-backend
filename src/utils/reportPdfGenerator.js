const PDFDocument = require('pdfkit');

/**
 * Helper: Draw a table row
 */
function drawTableRow(doc, y, columns, values, options = {}) {
  const { bold = false, fontSize = 9, fill = null } = options;

  if (fill) {
    doc.rect(columns[0].x - 5, y - 3, 510, 18).fill(fill).fillColor('#000');
  }

  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
  columns.forEach((col, i) => {
    doc.text(values[i] || '', col.x, y, {
      width: col.width,
      align: col.align || 'left'
    });
  });
}

/**
 * Helper: Format currency in Indian style
 */
function formatINR(amount) {
  if (!amount && amount !== 0) return '0.00';
  return amount.toFixed(2);
}

/**
 * Helper: Format date in Indian style
 */
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/**
 * Helper: Check and add new page if needed
 */
function checkPage(doc, y, threshold = 720) {
  if (y > threshold) {
    doc.addPage();
    return 50;
  }
  return y;
}

/**
 * Helper: Draw report header with business info
 */
function drawReportHeader(doc, businessDetails, title, period) {
  doc.fontSize(16).font('Helvetica-Bold').text(businessDetails.businessName || 'ChaiBooks', 50, 40);
  doc.fontSize(9).font('Helvetica');
  let y = 60;
  if (businessDetails.address) { doc.text(businessDetails.address, 50, y); y += 12; }
  if (businessDetails.gstin) { doc.text(`GSTIN: ${businessDetails.gstin}`, 50, y); y += 12; }
  if (businessDetails.phone) { doc.text(`Phone: ${businessDetails.phone}`, 50, y); y += 12; }

  doc.fontSize(14).font('Helvetica-Bold').text(title, 50, 40, { align: 'right' });
  if (period) {
    doc.fontSize(9).font('Helvetica').text(period, 50, 58, { align: 'right' });
  }
  doc.fontSize(8).font('Helvetica').text(`Generated: ${formatDate(new Date())}`, 50, 70, { align: 'right' });

  const headerBottom = Math.max(y + 5, 90);
  doc.moveTo(50, headerBottom).lineTo(560, headerBottom).stroke();
  return headerBottom + 15;
}

// ===================== SALES REPORT PDF =====================

async function generateSalesReportPDF(invoices, totals, businessDetails, period, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Sales-Report.pdf');
  doc.pipe(res);

  let y = drawReportHeader(doc, businessDetails, 'SALES REPORT', period);

  // Summary
  doc.fontSize(11).font('Helvetica-Bold').text('Summary', 50, y);
  y += 18;
  doc.fontSize(9).font('Helvetica');
  doc.text(`Total Invoices: ${totals.totalInvoices}`, 50, y);
  doc.text(`Total Sales: ₹${formatINR(totals.totalSales)}`, 200, y);
  doc.text(`Total GST: ₹${formatINR(totals.totalGST)}`, 380, y);
  y += 25;

  // Table header
  const cols = [
    { x: 50, width: 65, align: 'left' },
    { x: 115, width: 60, align: 'left' },
    { x: 175, width: 120, align: 'left' },
    { x: 295, width: 55, align: 'left' },
    { x: 350, width: 70, align: 'right' },
    { x: 420, width: 60, align: 'right' },
    { x: 480, width: 70, align: 'right' }
  ];

  drawTableRow(doc, y, cols,
    ['Invoice #', 'Date', 'Customer', 'GSTIN', 'Taxable', 'GST', 'Total'],
    { bold: true, fill: '#f3f4f6' }
  );
  y += 20;
  doc.moveTo(50, y - 5).lineTo(560, y - 5).stroke();

  // Invoice rows
  for (const inv of invoices) {
    y = checkPage(doc, y);
    drawTableRow(doc, y, cols, [
      inv.invoiceNumber,
      formatDate(inv.invoiceDate),
      (inv.customer?.name || 'N/A').substring(0, 20),
      inv.customer?.gstin || '-',
      formatINR(inv.subtotal),
      formatINR(inv.totalGst?.total),
      formatINR(inv.grandTotal)
    ]);
    y += 16;
  }

  // Total row
  y = checkPage(doc, y);
  doc.moveTo(50, y).lineTo(560, y).stroke();
  y += 5;
  drawTableRow(doc, y, cols,
    ['', '', '', 'TOTAL', formatINR(totals.totalTaxable), formatINR(totals.totalGST), formatINR(totals.totalSales)],
    { bold: true }
  );

  doc.end();
}

// ===================== PURCHASE REPORT PDF =====================

async function generatePurchaseReportPDF(invoices, totals, businessDetails, period, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Purchase-Report.pdf');
  doc.pipe(res);

  let y = drawReportHeader(doc, businessDetails, 'PURCHASE REPORT', period);

  // Summary
  doc.fontSize(11).font('Helvetica-Bold').text('Summary', 50, y);
  y += 18;
  doc.fontSize(9).font('Helvetica');
  doc.text(`Total Invoices: ${totals.totalInvoices}`, 50, y);
  doc.text(`Total Purchases: ₹${formatINR(totals.totalPurchases)}`, 200, y);
  doc.text(`Total GST (ITC): ₹${formatINR(totals.totalGST)}`, 380, y);
  y += 25;

  // Table
  const cols = [
    { x: 50, width: 65, align: 'left' },
    { x: 115, width: 60, align: 'left' },
    { x: 175, width: 120, align: 'left' },
    { x: 295, width: 55, align: 'left' },
    { x: 350, width: 70, align: 'right' },
    { x: 420, width: 60, align: 'right' },
    { x: 480, width: 70, align: 'right' }
  ];

  drawTableRow(doc, y, cols,
    ['Invoice #', 'Date', 'Supplier', 'GSTIN', 'Taxable', 'GST', 'Total'],
    { bold: true, fill: '#f3f4f6' }
  );
  y += 20;
  doc.moveTo(50, y - 5).lineTo(560, y - 5).stroke();

  for (const inv of invoices) {
    y = checkPage(doc, y);
    drawTableRow(doc, y, cols, [
      inv.invoiceNumber,
      formatDate(inv.invoiceDate),
      (inv.customer?.name || 'N/A').substring(0, 20),
      inv.customer?.gstin || '-',
      formatINR(inv.subtotal),
      formatINR(inv.totalGst?.total),
      formatINR(inv.grandTotal)
    ]);
    y += 16;
  }

  y = checkPage(doc, y);
  doc.moveTo(50, y).lineTo(560, y).stroke();
  y += 5;
  drawTableRow(doc, y, cols,
    ['', '', '', 'TOTAL', formatINR(totals.totalTaxable), formatINR(totals.totalGST), formatINR(totals.totalPurchases)],
    { bold: true }
  );

  doc.end();
}

// ===================== STOCK REPORT PDF =====================

async function generateStockReportPDF(items, summary, businessDetails, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=Stock-Report.pdf');
  doc.pipe(res);

  let y = drawReportHeader(doc, businessDetails, 'STOCK REPORT', null);

  // Summary
  doc.fontSize(11).font('Helvetica-Bold').text('Summary', 50, y);
  y += 18;
  doc.fontSize(9).font('Helvetica');
  doc.text(`Total Items: ${summary.totalItems}`, 50, y);
  doc.text(`Stock Value: ₹${formatINR(summary.totalStockValue)}`, 200, y);
  doc.text(`Low Stock Items: ${summary.lowStockItems}`, 380, y);
  y += 25;

  const cols = [
    { x: 50, width: 30, align: 'left' },
    { x: 80, width: 140, align: 'left' },
    { x: 220, width: 80, align: 'left' },
    { x: 300, width: 50, align: 'right' },
    { x: 350, width: 50, align: 'right' },
    { x: 400, width: 50, align: 'right' },
    { x: 450, width: 60, align: 'right' },
    { x: 510, width: 50, align: 'left' }
  ];

  drawTableRow(doc, y, cols,
    ['#', 'Item Name', 'Category', 'Qty', 'Bags', 'Min Lvl', 'Value (₹)', 'Status'],
    { bold: true, fill: '#f3f4f6' }
  );
  y += 20;
  doc.moveTo(50, y - 5).lineTo(560, y - 5).stroke();

  items.forEach((item, i) => {
    y = checkPage(doc, y);
    const qty = item.stock?.quantity || 0;
    const minLevel = item.stock?.minStockLevel || 0;
    const value = qty * (item.pricing?.purchasePrice || 0);
    const status = qty <= minLevel ? 'LOW' : 'OK';

    drawTableRow(doc, y, cols, [
      String(i + 1),
      (item.name || '').substring(0, 25),
      item.category || '-',
      String(qty),
      String(item.stock?.bags || 0),
      String(minLevel),
      formatINR(value),
      status
    ]);
    y += 16;
  });

  // Total
  y = checkPage(doc, y);
  doc.moveTo(50, y).lineTo(560, y).stroke();
  y += 5;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text(`Total Stock Value: ₹${formatINR(summary.totalStockValue)}`, 350, y, { width: 210, align: 'right' });

  doc.end();
}

// ===================== GST / GSTR-3B FORMAT PDF =====================

async function generateGSTReportPDF(gstData, businessDetails, period, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=GST-Report-GSTR3B.pdf');
  doc.pipe(res);

  let y = drawReportHeader(doc, businessDetails, 'FORM GSTR-3B', period);

  // Extract sale and purchase summary
  const saleSummary = gstData.summary.find(s => s._id === 'sale') || {};
  const purchaseSummary = gstData.summary.find(s => s._id === 'purchase') || {};

  // ---- Table 3.1: Outward Supplies ----
  doc.fontSize(11).font('Helvetica-Bold').text('3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge', 50, y);
  y += 20;

  const cols31 = [
    { x: 50, width: 170, align: 'left' },
    { x: 220, width: 80, align: 'right' },
    { x: 300, width: 65, align: 'right' },
    { x: 365, width: 65, align: 'right' },
    { x: 430, width: 65, align: 'right' },
    { x: 495, width: 65, align: 'right' }
  ];

  drawTableRow(doc, y, cols31,
    ['Nature of Supplies', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'],
    { bold: true, fill: '#e5e7eb' }
  );
  y += 18;
  doc.moveTo(50, y - 3).lineTo(560, y - 3).stroke();

  // (a) Outward taxable supplies (other than zero rated, nil rated and exempted)
  drawTableRow(doc, y, cols31, [
    '(a) Outward taxable supplies',
    formatINR(saleSummary.totalTaxableValue),
    formatINR(saleSummary.totalIGST),
    formatINR(saleSummary.totalCGST),
    formatINR(saleSummary.totalSGST),
    '0.00'
  ]);
  y += 16;

  // (b) Zero rated
  drawTableRow(doc, y, cols31, ['(b) Outward taxable supplies (zero rated)', '0.00', '0.00', '0.00', '0.00', '0.00']);
  y += 16;
  // (c) Nil rated / exempted
  drawTableRow(doc, y, cols31, ['(c) Other outward (nil rated, exempted)', '0.00', '0.00', '0.00', '0.00', '0.00']);
  y += 16;
  // (d) Inward supplies liable to reverse charge
  drawTableRow(doc, y, cols31, ['(d) Inward supplies (reverse charge)', '0.00', '0.00', '0.00', '0.00', '0.00']);
  y += 16;
  // (e) Non-GST outward supplies
  drawTableRow(doc, y, cols31, ['(e) Non-GST outward supplies', '0.00', '0.00', '0.00', '0.00', '0.00']);
  y += 25;

  // ---- Table 4: Eligible ITC ----
  y = checkPage(doc, y, 650);
  doc.fontSize(11).font('Helvetica-Bold').text('4. Eligible ITC (Input Tax Credit)', 50, y);
  y += 20;

  const cols4 = [
    { x: 50, width: 170, align: 'left' },
    { x: 220, width: 85, align: 'right' },
    { x: 305, width: 85, align: 'right' },
    { x: 390, width: 85, align: 'right' },
    { x: 475, width: 85, align: 'right' }
  ];

  drawTableRow(doc, y, cols4,
    ['Details', 'IGST', 'CGST', 'SGST', 'Cess'],
    { bold: true, fill: '#e5e7eb' }
  );
  y += 18;
  doc.moveTo(50, y - 3).lineTo(560, y - 3).stroke();

  // (A) ITC Available
  drawTableRow(doc, y, cols4, ['(A) ITC Available - whether in full or part', '', '', '', ''], { bold: true });
  y += 16;
  drawTableRow(doc, y, cols4, [
    '  (1) Import of goods',
    '0.00', '0.00', '0.00', '0.00'
  ]);
  y += 16;
  drawTableRow(doc, y, cols4, [
    '  (2) Import of services',
    '0.00', '0.00', '0.00', '0.00'
  ]);
  y += 16;
  drawTableRow(doc, y, cols4, [
    '  (3) Inward supplies (ISD)',
    '0.00', '0.00', '0.00', '0.00'
  ]);
  y += 16;
  drawTableRow(doc, y, cols4, [
    '  (4) All other ITC',
    formatINR(purchaseSummary.totalIGST),
    formatINR(purchaseSummary.totalCGST),
    formatINR(purchaseSummary.totalSGST),
    '0.00'
  ]);
  y += 16;
  // (B) ITC Reversed - simplified
  drawTableRow(doc, y, cols4, ['(B) ITC Reversed', '0.00', '0.00', '0.00', '0.00']);
  y += 16;
  // (C) Net ITC
  drawTableRow(doc, y, cols4, [
    '(C) Net ITC Available (A - B)',
    formatINR(purchaseSummary.totalIGST),
    formatINR(purchaseSummary.totalCGST),
    formatINR(purchaseSummary.totalSGST),
    '0.00'
  ], { bold: true });
  y += 25;

  // ---- Table 6.1: Tax Payable ----
  y = checkPage(doc, y, 650);
  doc.fontSize(11).font('Helvetica-Bold').text('6.1 Payment of Tax', 50, y);
  y += 20;

  const cols6 = [
    { x: 50, width: 110, align: 'left' },
    { x: 160, width: 80, align: 'right' },
    { x: 240, width: 80, align: 'right' },
    { x: 320, width: 80, align: 'right' },
    { x: 400, width: 80, align: 'right' },
    { x: 480, width: 80, align: 'right' }
  ];

  drawTableRow(doc, y, cols6,
    ['Description', 'Tax Payable', 'Paid (ITC)', 'Paid (Cash)', 'Interest', 'Late Fee'],
    { bold: true, fill: '#e5e7eb' }
  );
  y += 18;
  doc.moveTo(50, y - 3).lineTo(560, y - 3).stroke();

  const igstPayable = (saleSummary.totalIGST || 0);
  const igstITC = (purchaseSummary.totalIGST || 0);
  const igstCash = Math.max(0, igstPayable - igstITC);

  const cgstPayable = (saleSummary.totalCGST || 0);
  const cgstITC = (purchaseSummary.totalCGST || 0);
  const cgstCash = Math.max(0, cgstPayable - cgstITC);

  const sgstPayable = (saleSummary.totalSGST || 0);
  const sgstITC = (purchaseSummary.totalSGST || 0);
  const sgstCash = Math.max(0, sgstPayable - sgstITC);

  drawTableRow(doc, y, cols6, ['IGST', formatINR(igstPayable), formatINR(Math.min(igstITC, igstPayable)), formatINR(igstCash), '0.00', '0.00']);
  y += 16;
  drawTableRow(doc, y, cols6, ['CGST', formatINR(cgstPayable), formatINR(Math.min(cgstITC, cgstPayable)), formatINR(cgstCash), '0.00', '0.00']);
  y += 16;
  drawTableRow(doc, y, cols6, ['SGST', formatINR(sgstPayable), formatINR(Math.min(sgstITC, sgstPayable)), formatINR(sgstCash), '0.00', '0.00']);
  y += 16;
  drawTableRow(doc, y, cols6, ['Cess', '0.00', '0.00', '0.00', '0.00', '0.00']);
  y += 25;

  // ---- GST Rate-wise Breakup ----
  if (gstData.detailedByRate && gstData.detailedByRate.length > 0) {
    y = checkPage(doc, y, 650);
    doc.fontSize(11).font('Helvetica-Bold').text('Rate-wise Tax Breakup (Annexure)', 50, y);
    y += 20;

    const colsRate = [
      { x: 50, width: 80, align: 'left' },
      { x: 130, width: 50, align: 'right' },
      { x: 180, width: 80, align: 'right' },
      { x: 260, width: 65, align: 'right' },
      { x: 325, width: 65, align: 'right' },
      { x: 390, width: 65, align: 'right' },
      { x: 455, width: 55, align: 'right' },
      { x: 510, width: 50, align: 'right' }
    ];

    drawTableRow(doc, y, colsRate,
      ['Type', 'Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total GST', 'Value'],
      { bold: true, fill: '#e5e7eb' }
    );
    y += 18;
    doc.moveTo(50, y - 3).lineTo(560, y - 3).stroke();

    gstData.detailedByRate.forEach(item => {
      y = checkPage(doc, y);
      drawTableRow(doc, y, colsRate, [
        item._id.invoiceType === 'sale' ? 'Outward' : 'Inward',
        `${item._id.gstRate}%`,
        formatINR(item.taxableValue),
        formatINR(item.cgst),
        formatINR(item.sgst),
        formatINR(item.igst),
        formatINR(item.totalGst),
        formatINR(item.totalValue)
      ]);
      y += 16;
    });
  }

  // Footer
  y = checkPage(doc, y + 20, 680);
  doc.moveTo(50, y).lineTo(560, y).stroke();
  y += 10;
  doc.fontSize(8).font('Helvetica').text(
    'Note: This is a system-generated report for reference purposes. Please verify all figures before filing your actual GSTR-3B return on the GST portal.',
    50, y, { width: 510 }
  );

  doc.end();
}

module.exports = {
  generateSalesReportPDF,
  generatePurchaseReportPDF,
  generateStockReportPDF,
  generateGSTReportPDF
};
