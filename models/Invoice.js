const mongoose = require('mongoose');
const { Schema } = mongoose;

const InvoiceSchema = new Schema({
  client: { type: String, required: true, trim: true },
  product: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  location: { lat: Number, lng: Number },
  emailTo: { type: String, trim: true },
  emailSent: { type: Boolean, default: false },
  emailSentAt: { type: Date },
  emailSubject: { type: String, trim: true },
  emailMessage: { type: String, trim: true },
  status: { 
    type: String, 
    enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], 
    default: 'draft' 
  },
  paidAt: { type: Date },
  notes: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);


