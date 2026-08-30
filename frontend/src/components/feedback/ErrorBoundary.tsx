import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { t } from '@/i18n'
import { isDev } from '@/config/env'
import { ErrorState } from './ErrorState'

interface Props {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  resetKey?: unknown
  onError?: (error: Error, info: ErrorInfo) => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.reset()
    }
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div className="flex min-h-80 items-center justify-center p-gutter">
        <ErrorState
          error={error}
          onRetry={this.reset}
          action={
            <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
              {t('actions.reload')}
            </Button>
          }
        />
      </div>
    )
  }
}

export function SectionBoundary({ children, name }: { children: ReactNode; name?: string }) {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="surface-card">
          <ErrorState
            compact
            error={error}
            onRetry={reset}
            action={isDev && name ? <span className="text-2xs text-fg-subtle">in «{name}»</span> : null}
          />
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
