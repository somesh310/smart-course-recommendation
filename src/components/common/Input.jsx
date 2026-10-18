export default function Input({label,...props}){return <label style={{display:'block',marginBottom:15}}><span className="label">{label}</span><input className="field" {...props}/></label>}
