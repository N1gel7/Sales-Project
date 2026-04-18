# PostgreSQL Schemas (Supabase)

This project uses Supabase/PostgreSQL as the source of truth. Legacy MongoDB/Mongoose models have been removed.

## Users

```sql
create table if not exists public.users (
  id uuid not null default gen_random_uuid(),
  name varchar(255) not null,
  email varchar(255) not null unique,
  password_hash varchar(255) not null,
  role varchar(50) default 'sales',
  code varchar(50) unique,
  avatar_url text,
  active boolean default true,
  has_changed_initial_password boolean not null default false,
  reset_password_token varchar(255),
  reset_password_expires bigint,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  primary key (id)
);
```

## Invoices

```sql
create table if not exists public.invoices (
  id uuid not null default gen_random_uuid(),
  client varchar(255) not null,
  product varchar(255) not null,
  price numeric(10,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  status varchar(50) default 'draft',
  location jsonb,
  emailed boolean default false,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default current_timestamp,
  updated_at timestamptz default current_timestamp,
  email_to varchar(255),
  email_subject varchar(255),
  email_message text,
  email_sent_at timestamptz,
  primary key (id)
);
```

## Other Core Tables

The remaining primary tables are created and kept aligned in `scripts/init-db.js`:

- `categories`
- `products`
- `tasks`
- `uploads`
- `activity_logs`
- `chats`
- `messages`
- `reports`
- `notifications`

## Notes

- Use `npm run db:init` to create or align schema locally.
- Use `npm run db:add-password-flag` to add/backfill `has_changed_initial_password` for existing environments.
