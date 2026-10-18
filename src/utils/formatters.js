export const initials=name=>(name||'Learner').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
