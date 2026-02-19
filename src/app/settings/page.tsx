import { ArrowLeft, Settings2 } from 'lucide-react'
import Link from 'next/link'
import CredentialsSettings from '@/components/CredentialsSettings'
import { WhatsAppSettings } from '@/components/WhatsAppSettings'

export default function SettingsPage() {
    return (
        <div className="min-h-screen bg-[#0a0a0c] selection:bg-indigo-500/30">
            {/* Background decoration */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
            </div>

            <div className="relative max-w-7xl mx-auto px-6 py-8">
                <header className="flex justify-between items-center mb-12 animate-in slide-in-from-top duration-500">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="p-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all group"
                        >
                            <ArrowLeft className="h-5 w-5 text-white/60 group-hover:text-white group-hover:-translate-x-0.5 transition-all" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                                <Settings2 className="h-6 w-6 text-indigo-400" />
                                Settings
                            </h1>
                            <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Preferences & Credentials</p>
                        </div>
                    </div>
                </header>

                <main className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <section>
                        <h2 className="text-3xl font-black text-white mb-2 leading-tight">
                            Manage your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Credentials</span>
                        </h2>
                        <p className="text-white/40 max-w-2xl font-medium mb-8">
                            Keep your AI keys and school credentials up to date. Your information is stored securely in your private user profile.
                        </p>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <CredentialsSettings />
                            <WhatsAppSettings />
                        </div>
                    </section>
                </main>

                <footer className="mt-20 py-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-white/20 text-xs font-medium italic">
                        &quot;Privacy is not an option, and it shouldn&apos;t be the price we pay for just getting on the internet.&quot;
                    </p>
                </footer>
            </div>
        </div>
    )
}
