import { login } from './actions'
import { GraduationCap } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage({
    searchParams,
}: {
    searchParams: { message: string; error: string }
}) {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-indigo-600 via-indigo-500 to-indigo-800 py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8 rounded-2xl bg-white/10 p-8 shadow-2xl backdrop-blur-md border border-white/20">
                <div>
                    <div className="flex justify-center">
                        <div className="rounded-full bg-white/20 p-3">
                            <GraduationCap className="h-12 w-12 text-white" />
                        </div>
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-white">
                        Welcome Back
                    </h2>
                    <p className="mt-2 text-center text-sm text-indigo-100">
                        Sign in to your School Learning Buddy
                    </p>
                </div>

                <form className="mt-8 space-y-6" action={login}>
                    <div className="space-y-4 rounded-md shadow-xs">
                        <div>
                            <label htmlFor="email" className="sr-only">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="relative block w-full appearance-none rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white placeholder-indigo-200 focus:z-10 focus:border-white focus:outline-hidden focus:ring-1 focus:ring-white sm:text-sm transition-all"
                                placeholder="Email address"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="relative block w-full appearance-none rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-white placeholder-indigo-200 focus:z-10 focus:border-white focus:outline-hidden focus:ring-1 focus:ring-white sm:text-sm transition-all"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    {searchParams?.error && (
                        <div className="rounded-md bg-red-500/20 p-3 border border-red-500/50">
                            <p className="text-sm text-red-100">{searchParams.error}</p>
                        </div>
                    )}

                    {searchParams?.message && (
                        <div className="rounded-md bg-green-500/20 p-3 border border-green-500/50">
                            <p className="text-sm text-green-100">{searchParams.message}</p>
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <button
                            type="submit"
                            className="group relative flex w-full justify-center rounded-lg border border-transparent bg-white py-2.5 px-4 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 focus:outline-hidden focus:ring-2 focus:ring-white focus:ring-offset-2 transition-all shadow-lg active:scale-95"
                        >
                            Sign in
                        </button>
                        <div className="text-center">
                            <p className="text-sm text-indigo-100">
                                Don't have an account?{' '}
                                <Link href="/signup" className="font-medium text-white hover:underline underline-offset-4">
                                    Sign up for free
                                </Link>
                            </p>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
