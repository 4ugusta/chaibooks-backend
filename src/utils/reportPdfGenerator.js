const PDFDocument = require('pdfkit');

const PAGE_LEFT = 50;
const PAGE_RIGHT = 545;
const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;
const ROW_HEIGHT = 18;
const HEADER_ROW_HEIGHT = 20;

/**
 * Helper: Draw a table row with proper bounds
 */
function drawTableRow(doc, y, columns, values, options = {}) {
  const { bold = false, fontSize = 8, fill = null } = options;

  if (fill) {
    doc.save();
    doc.rect(PAGE_LEFT, y - 4, PAGE_WIDTH, HEADER_ROW_HEIGHT).fill(fill);
    doc.fillColor('#000');
    doc.restore();
    doc.fillColor('#000');
  }

  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
  columns.forEach((col, i) => {
    const val = (values[i] != null) ? String(values[i]) : '';
    doc.text(val, col.x, y, {
      width: col.w,
      align: col.align || 'left',
      lineBreak: false
    });
  });
}

/**
 * Draw a horizontal line across the page
 */
function drawLine(doc, y) {
  doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).lineWidth(0.5).stroke();
}

function formatINR(amount) {
  if (!amount && amount !== 0) return '0.00';
  return amount.toFixed(2);
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function checkPage(doc, y, threshold = 730) {
  if (y > threshold) {
    doc.addPage();
    return 50;
  }
  return y;
}

function drawReportHeader(doc, businessDetails, title, period) {
  // Left side: business info
  doc.fontSize(14).font('Helvetica-Bold').text(businessDetails.businessName || 'ChaiBooks', PAGE_LEFT, 40);
  doc.fontSize(8).font('Helvetica');
  let y = 58;
  if (businessDetails.address) { doc.text(businessDetails.address, PAGE_LEFT, y); y += 12; }
  if (businessDetails.gstin) { doc.text(`GSTIN: ${businessDetails.gstin}`, PAGE_LEFT, y); y += 12; }
  if (businessDetails.phone) { doc.text(`Phone: ${businessDetails.phone}`, PAGE_LEFT, y); y += 12; }

  // Right side: title
  doc.fontSize(13).font('Helvetica-Bold').text(title, PAGE_LEFT, 40, { width: PAGE_WIDTH, align: 'right' });
  if (period) {
    doc.fontSize(8).font('Helvetica').text(period, PAGE_LEFT, 56, { width: PAGE_WIDTH, align: 'right' });
  }
  doc.fontSize(7).font('Helvetica').text(`Generated: ${formatDate(new Date())}`, PAGE_LEFT, 68, { width: PAGE_WIDTH, align: 'right' });

  const headerBottom = Math.max(y + 5, 95);
  drawLine(doc, headerBottom);
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
  doc.fontSize(10).font('Helvetica-Bold').text('Summary', PAGE_LEFT, y);
  y += 16;
  doc.fontSize(8).font('Helvetica');
  doc.text(`Total Invoices: ${totals.totalInvoices}`, PAGE_LEFT, y);
  doc.text(`Total Sales: Rs.${formatINR(totals.totalSales)}`, 200, y);
  doc.text(`Total GST: Rs.${formatINR(totals.totalGST)}`, 380, y);
  y += 22;

  // Table columns — carefully spaced to avoid overlap
  const cols = [
    { x: 50,  w: 68,  align: 'left' },   // Invoice #
    { x: 122, w: 62,  align: 'left' },   // Date
    { x: 188, w: 100, align: 'left' },   // Customer
    { x: 292, w: 78,  align: 'left' },   // GSTIN
    { x: 374, w: 52,  align: 'right' },  // Taxable
    { x: 430, w: 50,  align: 'right' },  // GST
    { x: 484, w: 58,  align: 'right' }   // Total
  ];

  drawTableRow(doc, y, cols,
    ['Invoice #', 'Date', 'Customer', 'GSTIN', 'Taxable', 'GST', 'Total'],
    { bold: true, fill: '#f0f0f0' }
  );
  y += HEADER_ROW_HEIGHT + 2;
  drawLine(doc, y - 4);

  for (const inv of invoices) {
    y = checkPage(doc, y);
    drawTableRow(doc, y, cols, [
      inv.invoiceNumber || '',
      formatDate(inv.invoiceDate),
      (inv.customer?.name || 'N/A').substring(0, 18),
      (inv.customer?.gstin || '-').substring(0, 15),
      formatINR(inv.subtotal),
      formatINR(inv.totalGst?.total),
      formatINR(inv.grandTotal)
    ]);
    y += ROW_HEIGHT;
  }

  // Total row
  y = checkPage(doc, y);
  drawLine(doc, y - 2);
  y += 4;
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
  doc.fontSize(10).font('Helvetica-Bold').text('Summary', PAGE_LEFT, y);
  y += 16;
  doc.fontSize(8).font('Helvetica');
  doc.text(`Total Invoices: ${totals.totalInvoices}`, PAGE_LEFT, y);
  doc.text(`Total Purchases: Rs.${formatINR(totals.totalPurchases)}`, 200, y);
  doc.text(`Total GST (ITC): Rs.${formatINR(totals.totalGST)}`, 380, y);
  y += 22;

  const cols = [
    { x: 50,  w: 68,  align: 'left' },
    { x: 122, w: 62,  align: 'left' },
    { x: 188, w: 100, align: 'left' },
    { x: 292, w: 78,  align: 'left' },
    { x: 374, w: 52,  align: 'right' },
    { x: 430, w: 50,  align: 'right' },
    { x: 484, w: 58,  align: 'right' }
  ];

  drawTableRow(doc, y, cols,
    ['Invoice #', 'Date', 'Supplier', 'GSTIN', 'Taxable', 'GST', 'Total'],
    { bold: true, fill: '#f0f0f0' }
  );
  y += HEADER_ROW_HEIGHT + 2;
  drawLine(doc, y - 4);

  for (const inv of invoices) {
    y = checkPage(doc, y);
    drawTableRow(doc, y, cols, [
      inv.invoiceNumber || '',
      formatDate(inv.invoiceDate),
      (inv.customer?.name || 'N/A').substring(0, 18),
      (inv.customer?.gstin || '-').substring(0, 15),
      formatINR(inv.subtotal),
      formatINR(inv.totalGst?.total),
      formatINR(inv.grandTotal)
    ]);
    y += ROW_HEIGHT;
  }

  y = checkPage(doc, y);
  drawLine(doc, y - 2);
  y += 4;
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
  doc.fontSize(10).font('Helvetica-Bold').text('Summary', PAGE_LEFT, y);
  y += 16;
  doc.fontSize(8).font('Helvetica');
  doc.text(`Total Items: ${summary.totalItems}`, PAGE_LEFT, y);
  doc.text(`Stock Value: Rs.${formatINR(summary.totalStockValue)}`, 200, y);
  doc.text(`Low Stock Items: ${summary.lowStockItems}`, 380, y);
  y += 22;

  const cols = [
    { x: 50,  w: 30,  align: 'left' },   // #
    { x: 84,  w: 165, align: 'left' },   // Item Name
    { x: 253, w: 90,  align: 'left' },   // Category
    { x: 347, w: 55,  align: 'right' },  // Qty
    { x: 406, w: 50,  align: 'right' },  // Bags
    { x: 460, w: 45,  align: 'right' },  // Min Lvl
    { x: 510, w: 35,  align: 'left' }    // Status
  ];

  drawTableRow(doc, y, cols,
    ['#', 'Item Name', 'Category', 'Qty', 'Bags', 'Min Lvl', 'Status'],
    { bold: true, fill: '#f0f0f0' }
  );
  y += HEADER_ROW_HEIGHT + 2;
  drawLine(doc, y - 4);

  items.forEach((item, i) => {
    y = checkPage(doc, y);
    const qty = item.stock?.quantity || 0;
    const minLevel = item.stock?.minStockLevel || 0;
    const status = qty <= minLevel ? 'LOW' : 'OK';

    drawTableRow(doc, y, cols, [
      String(i + 1),
      (item.name || '').substring(0, 28),
      (item.category || '-').substring(0, 15),
      String(qty),
      String(item.stock?.bags || 0),
      String(minLevel),
      status
    ]);
    y += ROW_HEIGHT;
  });

  doc.end();
}

// ===================== GST / GSTR-3B FORMAT PDF =====================

async function generateGSTReportPDF(gstData, businessDetails, period, res) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=GST-Report-GSTR3B.pdf');
  doc.pipe(res);

  let y = drawReportHeader(doc, businessDetails, 'FORM GSTR-3B', period);

  const saleSummary = gstData.summary.find(s => s._id === 'sale') || {};
  const purchaseSummary = gstData.summary.find(s => s._id === 'purchase') || {};

  // ---- Table 3.1: Outward Supplies ----
  doc.fontSize(9).font('Helvetica-Bold').text(
    '3.1 Details of Outward Supplies and Inward Supplies Liable to Reverse Charge', PAGE_LEFT, y,
    { width: PAGE_WIDTH }
  );
  y += 18;

  const cols31 = [
    { x: 50,  w: 170, align: 'left' },
    { x: 224, w: 68,  align: 'right' },
    { x: 296, w: 62,  align: 'right' },
    { x: 362, w: 62,  align: 'right' },
    { x: 428, w: 58,  align: 'right' },
    { x: 490, w: 52,  align: 'right' }
  ];

  drawTableRow(doc, y, cols31,
    ['Nature of Supplies', 'Taxable Value', 'IGST', 'CGST', 'SGST', 'Cess'],
    { bold: true, fill: '#e8e8e8', fontSize: 7 }
  );
  y += HEADER_ROW_HEIGHT;
  drawLine(doc, y - 2);

  const gst31Rows = [
    ['(a) Outward taxable supplies', formatINR(saleSummary.totalTaxableValue), formatINR(saleSummary.totalIGST), formatINR(saleSummary.totalCGST), formatINR(saleSummary.totalSGST), '0.00'],
    ['(b) Outward (zero rated)', '0.00', '0.00', '0.00', '0.00', '0.00'],
    ['(c) Other outward (nil/exempted)', '0.00', '0.00', '0.00', '0.00', '0.00'],
    ['(d) Inward (reverse charge)', '0.00', '0.00', '0.00', '0.00', '0.00'],
    ['(e) Non-GST outward supplies', '0.00', '0.00', '0.00', '0.00', '0.00']
  ];

  gst31Rows.forEach(row => {
    drawTableRow(doc, y, cols31, row, { fontSize: 7 });
    y += ROW_HEIGHT;
  });
  y += 8;

  // ---- Table 4: Eligible ITC ----
  y = checkPage(doc, y, 600);
  doc.fontSize(9).font('Helvetica-Bold').text('4. Eligible ITC (Input Tax Credit)', PAGE_LEFT, y);
  y += 18;

  const cols4 = [
    { x: 50,  w: 180, align: 'left' },
    { x: 234, w: 75,  align: 'right' },
    { x: 313, w: 75,  align: 'right' },
    { x: 392, w: 75,  align: 'right' },
    { x: 471, w: 72,  align: 'right' }
  ];

  drawTableRow(doc, y, cols4,
    ['Details', 'IGST', 'CGST', 'SGST', 'Cess'],
    { bold: true, fill: '#e8e8e8', fontSize: 7 }
  );
  y += HEADER_ROW_HEIGHT;
  drawLine(doc, y - 2);

  drawTableRow(doc, y, cols4, ['(A) ITC Available', '', '', '', ''], { bold: true, fontSize: 7 });
  y += ROW_HEIGHT;
  drawTableRow(doc, y, cols4, ['   (1) Import of goods', '0.00', '0.00', '0.00', '0.00'], { fontSize: 7 });
  y += ROW_HEIGHT;
  drawTableRow(doc, y, cols4, ['   (2) Import of services', '0.00', '0.00', '0.00', '0.00'], { fontSize: 7 });
  y += ROW_HEIGHT;
  drawTableRow(doc, y, cols4, ['   (3) Inward supplies (ISD)', '0.00', '0.00', '0.00', '0.00'], { fontSize: 7 });
  y += ROW_HEIGHT;
  drawTableRow(doc, y, cols4, [
    '   (4) All other ITC',
    formatINR(purchaseSummary.totalIGST),
    formatINR(purchaseSummary.totalCGST),
    formatINR(purchaseSummary.totalSGST),
    '0.00'
  ], { fontSize: 7 });
  y += ROW_HEIGHT;
  drawTableRow(doc, y, cols4, ['(B) ITC Reversed', '0.00', '0.00', '0.00', '0.00'], { fontSize: 7 });
  y += ROW_HEIGHT;
  drawTableRow(doc, y, cols4, [
    '(C) Net ITC Available (A - B)',
    formatINR(purchaseSummary.totalIGST),
    formatINR(purchaseSummary.totalCGST),
    formatINR(purchaseSummary.totalSGST),
    '0.00'
  ], { bold: true, fontSize: 7 });
  y += ROW_HEIGHT + 8;

  // ---- Table 6.1: Tax Payable ----
  y = checkPage(doc, y, 600);
  doc.fontSize(9).font('Helvetica-Bold').text('6.1 Payment of Tax', PAGE_LEFT, y);
  y += 18;

  const cols6 = [
    { x: 50,  w: 85,  align: 'left' },
    { x: 139, w: 80,  align: 'right' },
    { x: 223, w: 80,  align: 'right' },
    { x: 307, w: 80,  align: 'right' },
    { x: 391, w: 75,  align: 'right' },
    { x: 470, w: 72,  align: 'right' }
  ];

  drawTableRow(doc, y, cols6,
    ['Description', 'Tax Payable', 'Paid (ITC)', 'Paid (Cash)', 'Interest', 'Late Fee'],
    { bold: true, fill: '#e8e8e8', fontSize: 7 }
  );
  y += HEADER_ROW_HEIGHT;
  drawLine(doc, y - 2);

  const igstPayable = saleSummary.totalIGST || 0;
  const igstITC = purchaseSummary.totalIGST || 0;
  const cgstPayable = saleSummary.totalCGST || 0;
  const cgstITC = purchaseSummary.totalCGST || 0;
  const sgstPayable = saleSummary.totalSGST || 0;
  const sgstITC = purchaseSummary.totalSGST || 0;

  const taxRows = [
    ['IGST', formatINR(igstPayable), formatINR(Math.min(igstITC, igstPayable)), formatINR(Math.max(0, igstPayable - igstITC)), '0.00', '0.00'],
    ['CGST', formatINR(cgstPayable), formatINR(Math.min(cgstITC, cgstPayable)), formatINR(Math.max(0, cgstPayable - cgstITC)), '0.00', '0.00'],
    ['SGST', formatINR(sgstPayable), formatINR(Math.min(sgstITC, sgstPayable)), formatINR(Math.max(0, sgstPayable - sgstITC)), '0.00', '0.00'],
    ['Cess', '0.00', '0.00', '0.00', '0.00', '0.00']
  ];

  taxRows.forEach(row => {
    drawTableRow(doc, y, cols6, row, { fontSize: 7 });
    y += ROW_HEIGHT;
  });
  y += 8;

  // ---- GST Rate-wise Breakup ----
  if (gstData.detailedByRate && gstData.detailedByRate.length > 0) {
    y = checkPage(doc, y, 600);
    doc.fontSize(9).font('Helvetica-Bold').text('Rate-wise Tax Breakup (Annexure)', PAGE_LEFT, y);
    y += 18;

    const colsRate = [
      { x: 50,  w: 65,  align: 'left' },
      { x: 119, w: 40,  align: 'right' },
      { x: 163, w: 72,  align: 'right' },
      { x: 239, w: 68,  align: 'right' },
      { x: 311, w: 68,  align: 'right' },
      { x: 383, w: 68,  align: 'right' },
      { x: 455, w: 88,  align: 'right' }
    ];

    drawTableRow(doc, y, colsRate,
      ['Type', 'Rate', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total GST'],
      { bold: true, fill: '#e8e8e8', fontSize: 7 }
    );
    y += HEADER_ROW_HEIGHT;
    drawLine(doc, y - 2);

    gstData.detailedByRate.forEach(item => {
      y = checkPage(doc, y);
      drawTableRow(doc, y, colsRate, [
        item._id.invoiceType === 'sale' ? 'Outward' : 'Inward',
        `${item._id.gstRate}%`,
        formatINR(item.taxableValue),
        formatINR(item.cgst),
        formatINR(item.sgst),
        formatINR(item.igst),
        formatINR(item.totalGst)
      ], { fontSize: 7 });
      y += ROW_HEIGHT;
    });
  }

  // Footer
  y = checkPage(doc, y + 15, 700);
  drawLine(doc, y);
  y += 8;
  doc.fontSize(7).font('Helvetica').text(
    'Note: This is a system-generated report for reference purposes. Please verify all figures before filing your actual GSTR-3B return on the GST portal.',
    PAGE_LEFT, y, { width: PAGE_WIDTH }
  );

  doc.end();
}

module.exports = {
  generateSalesReportPDF,
  generatePurchaseReportPDF,
  generateStockReportPDF,
  generateGSTReportPDF
};
