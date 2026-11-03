import { useRef } from 'react';
import { Climax } from './scenes/Climax';
import { Context } from './scenes/Context';
import { Conversion } from './scenes/Conversion';
import { Details } from './scenes/Details';
import { Impact } from './scenes/Impact';
import { Proposal } from './scenes/Proposal';
import { useScrollScenes } from './useScrollScenes';

// A vitrine: seis cenas, uma história. O scroll escreve o progresso de cada cena (useScrollScenes) e o CSS desenha tudo a
// partir dele. Exporta por padrão porque a rota "/" a carrega sob demanda (lazy): o GSAP e o Lenis só existem neste pacote.
export default function Showcase() {
  const root = useRef<HTMLElement>(null);
  useScrollScenes(root);

  return (
    <main ref={root}>
      <Impact />
      <Context />
      <Proposal />
      <Details />
      <Climax />
      <Conversion />
    </main>
  );
}
