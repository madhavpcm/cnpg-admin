'use client';

import React from 'react';

export function Loading({ message = 'Fetching Cluster..' }: { message?: string }) {
    return (
        <div className="loader-container min-h-[300px]">
            <div className="apple-spinner scale-125">
                {[...Array(12)].map((_, i) => (
                    <div key={i} style={{
                        transform: `rotate(${i * 30}deg)`,
                        animationDelay: `${-1.1 + (i * 0.1)}s`,
                        background: 'var(--cnp-purple)'
                    }} />
                ))}
            </div>
            <p className="fetching-text mt-8">{message}</p>
        </div>
    );
}
