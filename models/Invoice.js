import mongoose, { Schema } from 'mongoose';

const InvoiceSchema = new Schema({
  client: { type: String, required: true, trim: true },
  product: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  location: { lat: Number, lng: Number },
  emailed: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);


