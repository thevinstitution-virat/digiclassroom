'use client'

import React, { Component, ReactNode } from 'react'

interface Props {
    children?: ReactNode
    fallback?: ReactNode
    onReset?: () => void
}

interface State {
    hasError: boolean
}

export class ChatErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    }

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true }
    }

    public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Chat error:', error, errorInfo)
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                    Something went wrong in the chat component.
                </div>
            )
        }

        return this.props.children
    }
}
