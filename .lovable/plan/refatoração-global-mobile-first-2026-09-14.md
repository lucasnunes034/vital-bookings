# Refatoração global mobile-first

## Objetivo
Eliminar cortes, sobreposições e rolagem lateral nas telas móveis, preservando o layout atual no desktop.

## Implementação
1. **Base global responsiva**
   - Bloquear overflow horizontal no documento e no contêiner autenticado.
   - Padronizar os contêineres de página com largura total e 16 px laterais no celular.
   - Garantir que áreas internas possam encolher sem empurrar a tela.

2. **Abas e filtros**
   - Tornar todas as barras de abas roláveis horizontalmente no celular, sem barra visível e sem comprimir os títulos.
   - Empilhar os filtros de Agendamentos e manter todos os campos com largura total no celular.

3. **Calendário móvel estilo iPhone**
   - Manter a grade semanal atual apenas no desktop.
   - No celular, mostrar uma faixa horizontal rolável com os sete dias da semana.
   - Exibir abaixo somente os agendamentos do dia selecionado, em cards com horário, cliente, serviço e status.
   - Permitir criar um agendamento a partir do dia selecionado.

4. **Botões flutuantes**
   - Fixar “Novo agendamento” e “Novo serviço” no canto inferior direito no celular.
   - Reservar espaço inferior nas páginas para que o botão não cubra o último item.

## Validação
- Verificar Dashboard, Configurações, Agendamentos, Clientes, Orçamentos, Relatórios e Calendário em 392 × 852.
- Confirmar ausência de overflow horizontal e sobreposição.
- Confirmar que a grade semanal permanece intacta no desktop.
