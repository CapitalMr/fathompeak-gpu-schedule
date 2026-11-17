import { useState } from 'react'
import { useApp } from '../store/AppContext'

const VALID_USERNAME = 'wangxiaoliang@fathompeak.cn'
const VALID_PASSWORD = '12345678'

export function Login() {
  const { login } = useApp()
  const [loading, setLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (loading) return
    setError('')
    if (username.trim() !== VALID_USERNAME || password !== VALID_PASSWORD) {
      setError('账号或密码错误')
      return
    }
    setLoading(true)
    try {
      await login()
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-void p-3">
      <div className="grid min-h-[calc(100svh-24px)] w-full max-w-[1680px] grid-cols-1 lg:grid-cols-[minmax(0,min(48%,calc((100svh-24px)*0.666667)))_minmax(0,1fr)]">
        <div className="hidden self-start overflow-hidden rounded-3xl bg-[#dce7f7] lg:block">
          <img
            src={`${import.meta.env.BASE_URL}art/engraved-ascent.webp`}
            alt=""
            width={1024}
            height={1536}
            draggable={false}
            className="block aspect-[2/3] h-auto w-full object-cover"
          />
        </div>
        <div className="relative grid w-full content-center justify-self-center gap-3.5 px-6 py-12 lg:w-[440px] lg:px-6 lg:py-12">
          <div className="pointer-events-none absolute inset-0 -z-10 tech-grid opacity-40" />
          <img src={`${import.meta.env.BASE_URL}mark.svg`} alt="沐仞" className="h-auto w-28" />
          <p className="text-[12.5px] text-dim">沐仞</p>
          <h1 className="mt-1 text-[40px] leading-[1.12]">沐仞算电协同系统</h1>
          <form
            className="sheet mt-2 grid gap-3.5 p-5"
            onSubmit={(e) => {
              e.preventDefault()
              void handleLogin()
            }}
          >
            <label className="grid gap-1.5 text-[13px] text-dim">
              用户名
              <input
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  if (error) setError('')
                }}
                className="h-11 rounded-xl border border-border bg-white px-3.5 font-mono text-sm text-text outline-none focus:border-infer"
              />
            </label>
            <label className="grid gap-1.5 text-[13px] text-dim">
              密码
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError('')
                }}
                className="h-11 rounded-xl border border-border bg-white px-3.5 font-mono text-sm text-text outline-none focus:border-infer"
              />
            </label>
            {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="mt-1 h-11 rounded-full border border-infer bg-infer text-sm font-medium text-white hover:border-[#254f94] hover:bg-[#254f94] disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? '登录中…' : '登录'}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
