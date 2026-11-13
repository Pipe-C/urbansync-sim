import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { AmbientIntersection } from '@/components/simulation/AmbientIntersection'
import { SignalIcon } from '@/components/ui'

export interface AuthShellProps {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}

export function AuthShell({ eyebrow, title, description, children }: AuthShellProps) {
  return (
    <div className="relative min-h-screen bg-canvas">
      <div className="absolute inset-0 opacity-45 lg:left-[clamp(22rem,34%,34rem)] lg:opacity-100">
        <AmbientIntersection className="size-full" />
      </div>
      <div className="absolute inset-0 bg-canvas/50 lg:hidden" />

      <div className="relative z-10 w-full lg:absolute lg:inset-y-0 lg:left-0 lg:w-[clamp(22rem,34%,34rem)]">
        <div className="mx-5 my-8 rounded-lg border border-line bg-surface p-6 sm:mx-auto sm:max-w-sm sm:p-8 lg:mx-0 lg:my-0 lg:h-full lg:max-w-none lg:overflow-y-auto lg:rounded-none lg:border-0 lg:border-r lg:p-10">
          <div className="mx-auto flex h-full w-full max-w-sm flex-col justify-center">
            <Link
              to="/"
              className="flex items-center gap-2.5 text-sm font-medium text-primary transition-colors hover:text-accent"
            >
              <SignalIcon className="text-xl text-accent" />
              <span>UrbanSync Sim</span>
            </Link>

            <p className="mt-8 font-mono text-micro uppercase text-muted">{eyebrow}</p>

            <h1 className="mt-2 text-display font-semibold text-primary">{title}</h1>

            <p className="mt-3 text-sm text-secondary">{description}</p>

            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
