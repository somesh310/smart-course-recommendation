import {useState} from 'react';
export default function useLocalStorage(key,initial){const [value,setValue]=useState(()=>{try{const v=localStorage.getItem(key);return v?JSON.parse(v):initial}catch{return initial}});const update=next=>{setValue(prev=>{const v=typeof next==='function'?next(prev):next;localStorage.setItem(key,JSON.stringify(v));return v})};return [value,update]}
