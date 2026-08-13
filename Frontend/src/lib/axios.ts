import axios from 'axios';//axios, frontend'den backend'e HTTP isteği göndermek için kullanılan bir kütüphane.

//Axios instance'ı oluşturuyoruz. Bu instance, tüm HTTP isteklerinde kullanılacak ortak ayarları içerir.
export const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

//Token kontrolü ve Authorization header ekleme işlemi için axios interceptors kullanıyoruz.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});