import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

type Category = { _id: string; name: string; fields: Array<{ key: string; type: string; options?: string[] }> };

export default function Categories(): React.ReactElement {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [fieldKey, setFieldKey] = useState('');
  const [fieldType, setFieldType] = useState('text');

  async function load() {
    const data = await api.listCategories();
    setItems(data as Category[]);
  }
  useEffect(() => { load(); }, []);

  async function createCategory() {
    if (!name) return;
    await api.createCategory({ name, fields: fieldKey ? [{ key: fieldKey, type: fieldType }] : [] });
    setName(''); setFieldKey(''); setFieldType('text');
    await load();
  }

  async function remove(id: string) {
    await api.deleteCategory(id);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header">Create Category</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-3">
          <input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Category name" className="h-10 border border-gray-200 rounded-md px-3 text-sm" />
          <input value={fieldKey} onChange={(e)=>setFieldKey(e.target.value)} placeholder="Field key (optional)" className="h-10 border border-gray-200 rounded-md px-3 text-sm" />
          <select value={fieldType} onChange={(e)=>setFieldType(e.target.value)} className="h-10 border border-gray-200 rounded-md px-3 text-sm">
            <option value="text">text</option>
            <option value="number">number</option>
            <option value="price">price</option>
            <option value="dropdown">dropdown</option>
          </select>
          <button onClick={createCategory} className="h-10 rounded-md bg-blue-600 text-white text-sm px-3">Create</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">Categories</div>
        <div className="card-body">
          <ul className="divide-y divide-gray-100">
            {items.map((c) => (
              <li key={c._id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">Fields: {c.fields?.map(f=>f.key).join(', ') || '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>remove(c._id)} className="h-9 px-3 rounded-md border border-gray-200 text-sm">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}


