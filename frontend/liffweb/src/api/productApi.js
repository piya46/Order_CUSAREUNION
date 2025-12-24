// src/api/productApi.js
import api from './axios';

export async function getProducts() {
  const res = await api.get('/api/products');
  return res.data; // -> Product[]
}