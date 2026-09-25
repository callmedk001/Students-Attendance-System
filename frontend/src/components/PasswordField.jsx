import { useState } from 'react'

export default function PasswordField({
  name,
  value,
  onChange,
  autoComplete = 'new-password',
  required = false,
  id,
  placeholder,
})  {
  const [visible, setVisible] = useState(false)

  return <div className="password-field">
    <input id={id || name} name={name} type={visible ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} required={required}  placeholder={placeholder}/>
    <button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)} aria-label={`${visible ? 'Hide' : 'Show'} ${name}`}>
      {visible ? 'Hide' : 'Show'}
    </button>
  </div>
}
