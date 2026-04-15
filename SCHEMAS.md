### MongoDB Schemas (MERN on Vercel)

This document defines practical Mongoose schemas and example payloads for the Sales & Marketing Team Management System. The snippets use ESM `.js` and are compatible with Vercel serverless functions.

- Location object used in multiple models
```javascript
// Common shape
{
  lat: Number, // latitude
  lng: Number  // longitude
}
```

### User

Fields: basic profile, auth, and role-based access.
```javascript
// models/User.js
import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  name: { type: String, trim: true, required: true },
  email: { type: String, trim: true, lowercase: true, unique: true, required: true, index: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin','manager','sales'], default: 'sales', index: true },
  avatarUrl: String,
  active: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);
```

Example:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "manager"
}
```

### Category

Admin-defined product categories with dynamic fields (supports dropdowns, text, number, price).
```javascript
// models/Category.js
import mongoose, { Schema } from 'mongoose';

const CategorySchema = new Schema({
  name: { type: String, required: true, trim: true, unique: true },
  fields: [{
    key: { type: String, required: true },      // e.g., "size", "brand", "notes"
    type: { type: String, enum: ['text','number','price','dropdown'], default: 'text' },
    options: [String]                            // for dropdown options
  }]
}, { timestamps: true });

export default mongoose.models.Category || mongoose.model('Category', CategorySchema);
```

Example:
```json
{
  "name": "Beverages",
  "fields": [
    { "key": "size_ml", "type": "number" },
    { "key": "brand", "type": "dropdown", "options": ["BrandA", "BrandB"] }
  ]
}
```

### Product

Belongs to a category; supports freeform details and dynamic attributes.
```javascript
// models/Product.js
import mongoose, { Schema } from 'mongoose';

const ProductSchema = new Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, index: true },
  price: { type: Number, required: true, min: 0 },
  details: String,
  attributes: Schema.Types.Mixed // key/value dynamic fields based on Category.fields
}, { timestamps: true });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
```

Example:
```json
{
  "name": "Orange Juice",
  "category": "Beverages",
  "price": 9.99,
  "attributes": { "size_ml": 500, "brand": "BrandA" }
}
```

### Task

Assignments with lightweight workflow.
```javascript
// models/Task.js
import mongoose, { Schema } from 'mongoose';

const TaskSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: String,
  assignee: { type: String, required: true, index: true }, // email or userId
  dueAt: Date,
  status: { type: String, enum: ['pending','in_progress','done'], default: 'pending', index: true },
  createdBy: String
}, { timestamps: true });

export default mongoose.models.Task || mongoose.model('Task', TaskSchema);
```

Example:
```json
{
  "title": "Visit Shop 12",
  "description": "Capture shelf photos and confirm pricing",
  "assignee": "rep12@example.com",
  "dueAt": "2025-10-18T16:00:00.000Z"
}
```

### Activity

Append-only feed for dashboard insights.
```javascript
// models/Activity.js
import mongoose, { Schema } from 'mongoose';

const ActivitySchema = new Schema({
  type: { type: String, required: true }, // e.g., 'visit_completed','upload_media','invoice_sent'
  actor: String,                           // user email or id
  ref: { type: String },                   // related entity id (taskId, invoiceId, etc.)
  meta: Schema.Types.Mixed                 // flexible metadata
}, { timestamps: true });

export default mongoose.models.Activity || mongoose.model('Activity', ActivitySchema);
```

Example:
```json
{
  "type": "upload_media",
  "actor": "rep12@example.com",
  "ref": "665abcf0123",
  "meta": { "count": 3, "category": "Beverages" }
}
```

### Media

Tracks uploads (images, video, audio) with on-upload geolocation. Store only URLs; files live in Cloudinary/S3.
```javascript
// models/Media.js
import mongoose, { Schema } from 'mongoose';

const MediaSchema = new Schema({
  kind: { type: String, enum: ['image','video','audio'], required: true },
  url: { type: String, required: true },
  thumbUrl: String,
  uploadedBy: String, // user id or email
  location: {
    lat: Number,
    lng: Number
  },
  tags: [String],
  transcript: String,        // for audio (optional)
  transcriptLang: String
}, { timestamps: true });

export default mongoose.models.Media || mongoose.model('Media', MediaSchema);
```

Example:
```json
{
  "kind": "image",
  "url": "https://res.cloudinary.com/demo/image/upload/abc.jpg",
  "uploadedBy": "rep12@example.com",
  "location": { "lat": 5.560, "lng": -0.205 },
  "tags": ["shelf", "promo"]
}
```

### Invoice

Rep-generated bill including location stamp; can be emailed.
```javascript
// models/Invoice.js
import mongoose, { Schema } from 'mongoose';

const InvoiceSchema = new Schema({
  client: { type: String, required: true, trim: true },
  product: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  items: [{
    productId: { type: String },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    price: { type: Number, required: true, min: 0 }
  }],
  location: { lat: Number, lng: Number },
  emailed: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
```

Example:
```json
{
  "client": "Kumasi Wholesale",
  "product": "Orange Juice x24",
  "price": 199.5,
  "location": { "lat": 6.690, "lng": -1.620 },
  "emailed": false
}
```

---

### PostgreSQL Schema (Supabase)

For Supabase/PostgreSQL users, use the following SQL to create the `invoices` table with multi-product support.

```sql
create table public.invoices (
  id uuid not null default gen_random_uuid (),
  client character varying(255) not null,
  product character varying(255) not null, -- Summary of items
  price numeric(10, 2) not null default 0, -- Total price
  items jsonb not null default '[]'::jsonb, -- Array of { productId, name, quantity, price }
  status character varying(50) null default 'draft'::character varying,
  location jsonb null,
  emailed boolean null default false,
  created_by uuid null,
  created_at timestamp with time zone null default CURRENT_TIMESTAMP,
  updated_at timestamp with time zone null default CURRENT_TIMESTAMP,
  email_to character varying(255) null,
  email_subject character varying(255) null,
  email_message text null,
  email_sent_at timestamp with time zone null,
  constraint invoices_pkey primary key (id),
  constraint invoices_created_by_fkey foreign KEY (created_by) references users (id) on delete set null
) TABLESPACE pg_default;
```

**To update an existing table:**
```sql
ALTER TABLE public.invoices 
ADD COLUMN items jsonb NOT NULL DEFAULT '[]'::jsonb;
```

---


Notes
- All models use `{ timestamps: true }` (or triggers in Postgres) for `createdAt` and `updatedAt`.
- For Vercel serverless, reuse a single cached Mongoose connection to avoid connection thrash.
- Media files should be uploaded directly to Cloudinary/S3; store returned URLs here.
- Add indexes based on your query patterns (e.g., `category`, `assignee`, `role`).



