import PDFDocument from 'pdfkit';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString();
}

export async function generateInvoicePdfBuffer(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(22).text('Sales Invoice', { align: 'left' });
    doc.moveDown(0.25);
    doc.fontSize(10).fillColor('#666').text(`Invoice ID: ${invoice.id}`);
    doc.text(`Created At: ${formatDate(invoice.created_at)}`);
    doc.moveDown();

    doc.fillColor('#000').fontSize(12).text('Client Details', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(11).text(`Client: ${invoice.client}`);
    doc.moveDown();

    doc.fontSize(12).text('Invoice Details', { underline: true });
    doc.moveDown(0.4);
    
    if (invoice.items && invoice.items.length > 0) {
      invoice.items.forEach((item, index) => {
        const itemText = `${index + 1}. ${item.name} x${item.quantity || 1} - ${formatCurrency(item.price)}`;
        doc.fontSize(11).text(itemText);
      });
      doc.moveDown(0.5);
    } else {
      doc.fontSize(11).text(`Product: ${invoice.product}`);
    }
    
    doc.fontSize(12).text(`Total Amount: ${formatCurrency(invoice.price)}`, { bold: true });
    doc.fontSize(11).text(`Status: ${invoice.status || 'draft'}`);
    doc.text(`Emailed: ${invoice.emailed ? 'Yes' : 'No'}`);
    
    if (invoice.location?.lat && invoice.location?.lng) {
      doc.text(`Location: ${invoice.location.lat}, ${invoice.location.lng}`);
    }

    doc.moveDown(2);
    doc.fontSize(10).fillColor('#666').text('Thank you for doing business with us.', {
      align: 'center',
    });

    doc.end();
  });
}
