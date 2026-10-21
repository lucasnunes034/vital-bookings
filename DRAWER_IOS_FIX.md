# Correção para Drawer no iOS Safari - Teclado Virtual

## Problema
No iOS Safari, quando um drawer (gaveta) é aberto e o usuário clica em um input, o teclado virtual sobe e empurra incorretamente o container do drawer, gerando espaços em branco e uma experiência ruim.

## Solução Implementada

### 1. **Unidades de Viewport Dinâmicas (dvh)**
Foi implementado o uso de `dvh` (dynamic viewport height) ao invés de `vh` tradicional. O `dvh` se ajusta automaticamente quando o teclado virtual aparece ou desaparece no iOS.

```css
/* Antes */
max-h-[92vh]

/* Depois */
max-h-[92dvh]
```

### 2. **CSS Específico para iOS Safari**
Adicionado CSS no arquivo `src/styles.css` com múltiplas correções:

```css
@supports (-webkit-touch-callout: none) {
  /* Detecta iOS Safari */
  
  [vaul-drawer] {
    position: fixed !important;
    bottom: 0 !important;
    max-height: 92dvh !important;
  }

  /* Previne scroll do body quando drawer está aberto */
  body:has([vaul-drawer][data-state="open"]) {
    overflow: hidden !important;
    position: fixed !important;
  }

  /* Scroll suave em elementos scrolláveis */
  [vaul-drawer] .overflow-y-auto {
    -webkit-overflow-scrolling: touch !important;
    overscroll-behavior: contain !important;
  }
}
```

### 3. **Classe CSS Auxiliar**
Criada classe `.ios-keyboard-fix` que usa aceleração de hardware para melhor performance:

```css
.ios-keyboard-fix {
  position: fixed !important;
  transform: translate3d(0, 0, 0) !important;
  will-change: transform !important;
}
```

### 4. **Componente Drawer Atualizado**
O componente `src/components/ui/drawer.tsx` foi atualizado com classes específicas:

```tsx
<DrawerPrimitive.Content
  className={cn(
    "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-background",
    // Correção para iOS Safari
    "max-h-[100dvh] supports-[height:100dvh]:max-h-[100dvh]",
    "ios-keyboard-fix",
    className,
  )}
>
```

### 5. **Layout Flexbox Otimizado**
Ajustado o layout do drawer para usar flexbox corretamente:

```tsx
<DrawerContent className="max-h-[92dvh] flex flex-col">
  <DrawerHeader className="text-left flex-shrink-0">
    {/* Header fixo */}
  </DrawerHeader>
  <div className="px-4 pb-6 overflow-y-auto flex-1 min-h-0">
    {/* Conteúdo scrollável */}
  </div>
</DrawerContent>
```

**Explicação:**
- `flex flex-col`: Container como flexbox vertical
- `flex-shrink-0`: Header não encolhe
- `flex-1 min-h-0`: Conteúdo ocupa espaço restante e permite scroll

### 6. **Hooks React Opcionais**
Criados hooks em `src/hooks/use-ios-keyboard.ts` para casos avançados:

#### `useIOSKeyboard()`
Detecta se o teclado está aberto:

```tsx
import { useIOSKeyboard } from '@/hooks/use-ios-keyboard';

const MyDrawer = () => {
  const isKeyboardOpen = useIOSKeyboard();
  
  return (
    <DrawerContent className={cn(
      "max-h-[92dvh]",
      isKeyboardOpen && "max-h-[50dvh]" // Ajusta altura quando teclado abre
    )}>
      {/* conteúdo */}
    </DrawerContent>
  );
};
```

#### `useIOSViewportHeight()`
Retorna altura exata disponível:

```tsx
import { useIOSViewportHeight } from '@/hooks/use-ios-keyboard';

const MyDrawer = () => {
  const { availableHeight, keyboardHeight } = useIOSViewportHeight();
  
  return (
    <DrawerContent style={{ maxHeight: `${availableHeight * 0.92}px` }}>
      {/* conteúdo */}
    </DrawerContent>
  );
};
```

## Como Aplicar em Outros Drawers

### Solução Rápida (Recomendada)
Apenas use `dvh` ao invés de `vh`:

```tsx
<DrawerContent className="max-h-[92dvh] flex flex-col">
  <DrawerHeader className="flex-shrink-0">
    {/* Header */}
  </DrawerHeader>
  <div className="overflow-y-auto flex-1 min-h-0">
    {/* Conteúdo scrollável */}
  </div>
</DrawerContent>
```

### Solução Avançada
Se precisar de controle fino, use os hooks:

```tsx
import { useIOSKeyboard } from '@/hooks/use-ios-keyboard';

const isKeyboardOpen = useIOSKeyboard();

<DrawerContent className={cn(
  "max-h-[92dvh]",
  isKeyboardOpen && "max-h-[60dvh]"
)}>
  {/* ... */}
</DrawerContent>
```

## Compatibilidade

- **iOS Safari 13+**: Suporte completo (Visual Viewport API + dvh)
- **iOS Safari 11-12**: Suporte parcial (fallback para -webkit-fill-available)
- **Outros navegadores**: Funcionamento normal (sem impacto)

## Referências Técnicas

- **dvh/svh/lvh**: [CSS Values and Units Level 4](https://drafts.csswg.org/css-values-4/#viewport-relative-lengths)
- **Visual Viewport API**: [MDN - Visual Viewport API](https://developer.mozilla.org/en-US/docs/Web/API/Visual_Viewport_API)
- **Vaul Library**: [github.com/emilkowalski/vaul](https://github.com/emilkowalski/vaul)

## Testando no iOS

1. Abra o drawer em um dispositivo iOS real ou simulador
2. Clique em qualquer input dentro do drawer
3. Verifique que:
   - O drawer permanece fixo no topo do teclado
   - Não há espaço em branco abaixo do drawer
   - O conteúdo interno pode ser scrollado normalmente
   - O header permanece visível

## Problemas Conhecidos e Limitações

1. **Orientação do dispositivo**: Ao rotacionar o dispositivo com teclado aberto, pode haver um breve ajuste
2. **Teclados de terceiros**: Alguns teclados customizados podem ter comportamento diferente
3. **SafeArea**: Em dispositivos com notch, considere usar `env(safe-area-inset-bottom)` se necessário

## Manutenção Futura

Se aparecerem novos problemas:

1. Verifique no DevTools do Safari Mobile se `dvh` está sendo aplicado
2. Teste com diferentes tamanhos de drawer (70dvh, 80dvh, 92dvh)
3. Considere usar os hooks para casos edge
4. Verifique se o Vaul foi atualizado e possui correções nativas
