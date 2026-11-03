import type { CSSProperties, ReactNode } from 'react';
import styles from './showcase.module.css';

export type SceneId = 1 | 2 | 3 | 4 | 5 | 6;

export interface SceneProps {
  id: SceneId;
  /** Cena que o scroll prende na janela enquanto o progresso corre de 0 a 1 (o motor lê `data-pinned`). */
  pinned?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Uma cena da vitrine. O motor (useScrollScenes) a encontra por `[data-scene]` e escreve o progresso dela, de 0 a 1,
 * em `data-progress` (três casas) e na variável CSS `--p`: o CSS desenha tudo a partir de `--p`, sem React no meio do
 * scroll. As duas começam em zero; o React não as reescreve, porque o valor delas não muda entre renders.
 */
export function Scene({ id, pinned = false, className, children }: SceneProps) {
  return (
    <section
      className={[styles.scene, className].filter(Boolean).join(' ')}
      data-scene={id}
      data-pinned={pinned ? '' : undefined}
      data-progress="0.000"
      style={{ '--p': 0 } as CSSProperties}
    >
      {children}
    </section>
  );
}
