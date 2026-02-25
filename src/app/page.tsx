import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GraduationCap, LogOut, User as UserIcon, Bell } from 'lucide-react'
import Link from 'next/link'
import Dashboard from '@/components/Dashboard'

export default async function Home() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return redirect('/login')
  }

  async function signOut() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] selection:bg-indigo-500/30">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-8">
        <header className="flex justify-between items-center mb-12 animate-in slide-in-from-top duration-500">
          <div className="flex items-center gap-4 group">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg ring-4 ring-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
              <GraduationCap className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Leraar AI</h1>
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Smart Learning Buddy</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/discover" className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/20 hover:to-teal-500/20 border border-emerald-500/20 text-emerald-400 font-bold rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20">
              Discover & Remix
            </Link>
            <Link href="/plugins" className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20 border border-violet-500/20 text-violet-400 font-bold rounded-xl transition-all shadow-lg hover:shadow-violet-500/20">
              Plugin Marketplace
            </Link>
            <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-indigo-500 rounded-full border border-black" />
            </button>

            <div className="h-10 w-px bg-white/10 mx-2" />

            <div className="flex items-center gap-3 p-1.5 pl-3 bg-white/5 border border-white/10 rounded-2xl">
              <span className="text-xs font-medium text-white/80 hidden sm:inline">{user.email?.split('@')[0]}</span>
              <form action={signOut}>
                <button className="p-2 rounded-xl bg-indigo-500/10 hover:bg-red-500/20 text-indigo-400 hover:text-red-400 transition-all border border-indigo-500/20 hover:border-red-500/20 group/logout">
                  <LogOut className="h-4 w-4 group-hover/logout:-translate-x-0.5 transition-transform" />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main>
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-4xl font-black text-white mb-2 leading-tight">
              What do you want to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">master</span> today?
            </h2>
            <p className="text-white/40 max-w-2xl font-medium">
              Choose your subjects, combine materials into focus groups, and start your personalized AI-driven learning journey.
            </p>
          </div>

          <Dashboard />
        </main>

        <footer className="mt-20 py-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-white/20 text-xs font-medium italic">
            &quot;The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.&quot;
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-white/20 hover:text-white transition-colors text-[10px] uppercase tracking-widest font-bold">Help Center</a>
            <Link href="/settings" className="text-white/20 hover:text-white transition-colors text-[10px] uppercase tracking-widest font-bold">Account Settings</Link>
          </div>
        </footer>
      </div>
    </div>
  )
}
