import { Loader2 } from 'lucide-react'

export default function SettingsLoading() {
    return (
        <div className="min-h-screen bg-[#0a0a0c] flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 text-indigo-500 animate-spin" />
            <p className="text-white/40 font-medium">Loading settings...</p>
        </div>
    )
}
