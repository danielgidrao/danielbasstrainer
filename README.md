# braço — treino de notas no baixo

Webapp pra treinar teoria no braço do contrabaixo. Aparece uma nota (notação latina:
Dó Ré Mi…) e você clica onde ela fica no braço. Dá pra filtrar por naturais/todas,
ligar/desligar cordas e limitar a faixa de casas. Feedback visual + sonoro.

## Rodar localmente

Precisa de [Node.js](https://nodejs.org) (versão 18+).

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente http://localhost:5173).
Salvou um arquivo, a página recarrega sozinha.

## Build de produção

```bash
npm run build      # gera a pasta dist/
npm run preview    # serve o build localmente pra conferir
```

O conteúdo de `dist/` é estático — pode subir em Netlify, Vercel, GitHub Pages etc.

## Estrutura

```
src/
  NoteFinder.tsx   # o app inteiro (lógica de teoria + braço em SVG + placar)
  App.tsx          # monta o NoteFinder
  main.tsx         # ponto de entrada
  index.css        # reset mínimo
  assets/
    correct.mp3    # som de acerto
    wrong.mp3      # som de erro
```

## Notas de implementação

- A teoria é aritmética módulo 12: a nota em `(corda, casa)` é `(cordaSolta + casa) % 12`.
- Afinação assumida: 4 cordas padrão, Mi Lá Ré Sol (grave -> agudo), corda grave embaixo.
- Acidentes exibidos como sustenido (♯).
- Os sons são importados como assets (o Vite versiona o arquivo). Se preferir,
  mova pra `public/` e troque os imports por `new Audio("/correct.mp3")`.

## Ideias de próximos passos

- Afinação configurável / 5ª e 6ª cordas.
- Modo inverso: mostra a posição, você diz a nota.
- Persistir o placar com `localStorage`.
- Bequadro/bemol além de sustenido; intervalos e tríades.
```
