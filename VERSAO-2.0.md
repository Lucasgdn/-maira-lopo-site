# Plano da versao 2.0

## Situacao atual

A versao 2.0 da agenda propria esta publicada e segue recebendo melhorias. As alteracoes recentes foram enviadas para a branch de producao e o build local foi concluido com sucesso. A validacao real de agendamento e reagendamento fica para a proprietaria, sem criar reservas de teste ou enviar mensagens a clientes durante o desenvolvimento.

## Objetivo da versao 2.0

Criar uma agenda integrada ao site com procedimentos, duracoes, precos, profissionais, datas, horarios e confirmacao pelo WhatsApp.

O painel administrativo em `/admin` usa Firebase Authentication, e-mail e senha, verifica uma lista de administradores no Firestore e oferece uma agenda semanal inspirada no Outlook, com eventos de bloqueio, configuracao da rotina por dia da semana e reservas de clientes. Reservas simultaneas aparecem lado a lado, e a agenda pode ser filtrada por profissional. Confirmar ou cancelar uma reserva atualiza a agenda e abre uma mensagem pronta no WhatsApp para a Maira revisar e enviar. Reservas confirmadas podem ser reagendadas dentro da disponibilidade da profissional; a alteracao dos bloqueios ocorre em transacao e abre uma mensagem pronta com a nova data e horario. Se a abertura automatica for bloqueada, o painel apresenta um link alternativo.

Os cards de servicos abrem um calendario publico com dias e horarios calculados a partir da disponibilidade do Firestore. Se houver mais de uma profissional, a cliente escolhe em cards qual delas atendera antes de ver as datas e horarios; horarios ocupados sao independentes por profissional. Cada servico informa sua propria duracao; os inicios sao oferecidos a cada 15 minutos e o bloqueio usa o tempo exato em intervalos internos de 5 minutos. Reservas concorrentes sao protegidas por transacoes do Firestore. Bloqueios manuais de datas e eventos cadastrados no calendario sao globais, aplicaveis a todas as profissionais. O site e o painel mostram instrucoes de ajuda e permitem relatar problemas pelo WhatsApp da Maira, com mensagens iniciais diferentes conforme a origem.

### Acesso e escopo inicial

- A agenda sera inicialmente exclusiva da Maira; nao sera um produto white label nesta etapa.
- Nao havera cadastro publico de administradores nem de profissionais.
- A proprietaria controla quem recebe acesso e pode convidar/aprovar novas contas.
- As clientes poderao agendar sem criar conta.
- Novos acessos devem receber apenas as permissoes administrativas necessarias.
- Uma futura versao white label exigira uma etapa separada de arquitetura para separar empresas e dados.

## Agenda propria

### Experiencia da cliente

1. A cliente acessa os cards de procedimentos e toca em "Agendar".
2. Se houver mais de uma profissional, escolhe uma nos cards de selecao; com uma unica profissional, ela e selecionada automaticamente.
3. O calendario mostra dias e horarios compativeis com a agenda escolhida, bloqueios e duracao do servico.
4. A cliente informa nome e WhatsApp obrigatorios.
5. O pedido fica como pendente e ocupa os intervalos para evitar conflito.
6. A Maira ve a reserva no painel e pode confirma-la ou cancela-la; cada acao atualiza a agenda e prepara uma mensagem correspondente no WhatsApp.
7. Em reservas confirmadas, a Maira pode alterar a data e o horario. O sistema verifica a disponibilidade da profissional e conflitos, troca os bloqueios em uma transacao e prepara uma mensagem para avisar a cliente.
8. Para reservas confirmadas, **Enviar lembrete** abre outra mensagem pronta no WhatsApp. As mensagens sao revisadas e enviadas manualmente pela Maira; o site nao envia mensagens automaticamente.

### Disponibilidade definida pela profissional

O painel administrativo protegido por login permite:

- Definir os dias da semana em que atende.
- Definir os primeiros e ultimos horarios de atendimento.
- Criar intervalos de trabalho, como almoco ou pausas.
- Bloquear feriados e dias inteiros.
- Bloquear horarios individuais.
- Registrar horarios ocupados por atendimentos feitos fora do site.
- Visualizar agendamentos pendentes e confirmados, tambem na agenda semanal.
- Filtrar a agenda semanal por profissional ou visualizar todas juntas.
- Ver reservas simultaneas lado a lado na agenda semanal.
- Confirmar, cancelar ou reagendar reservas; ao cancelar, liberar os horarios ocupados.
- Abrir mensagens prontas de confirmacao, cancelamento, reagendamento e lembrete pelo WhatsApp.
- Usar e filtrar a agenda por profissional.

No celular, a administradora pode criar um atalho para `/admin` na tela inicial. No Android, abrir no Chrome e escolher **Adicionar a tela inicial** ou **Instalar app** no menu. No iPhone, abrir no Safari, tocar em **Compartilhar** e escolher **Adicionar a Tela de Inicio**. O acesso continua protegido pelo login do painel.

Exemplo de configuracao:

- Segunda a sexta: 09:00 as 18:00.
- Almoco: 12:00 as 13:00.
- Sabado: 09:00 as 13:00.
- Duracao excedida pelo procedimento: o sistema ocupa o intervalo inteiro.

## Controle de horarios

A versao 2.0 usa Firebase:

- Firebase Authentication para o painel administrativo.
- Cloud Firestore para profissionais, procedimentos, horarios, bloqueios e reservas.
- Firestore Transactions para impedir reservas concorrentes.
- Firebase Security Rules para manter os dados de clientes visiveis apenas para administradoras ativas.

Cada reserva sera vinculada a:

- Procedimento, preco e duracao.
- Profissional.
- Data.
- Horario inicial.
- Horario final calculado pela duracao.
- Nome da cliente.
- WhatsApp.
- Status: pendente, confirmado ou cancelado.

O sistema bloqueara automaticamente intervalos que tenham conflito. Duas reservas podem ocorrer no mesmo horario somente se forem de profissionais diferentes e houver disponibilidade para ambas.

## Versao e instalacao

- Versao atual: 2.0.
- A versao e centralizada em `app/lib/site-config.ts` e exibida discretamente no rodape do site e do painel.
- Instrucoes de ajuda e o atalho para relatar problemas pelo WhatsApp estao disponiveis no site e no painel administrativo.
- Quando ha varias profissionais, a cliente escolhe quem atendera; os horarios e reservas sao independentes por profissional, e a agenda administrativa permite filtrar por pessoa.
- A selecao publica da profissional usa cards clicaveis; ao mudar de profissional, as datas e horarios disponiveis sao recalculados.
- Reservas simultaneas de profissionais diferentes aparecem lado a lado na agenda semanal; no celular, os eventos do dia sao apresentados em lista.
- Reservas confirmadas podem ser reagendadas dentro da disponibilidade individual da profissional, com validacao de conflito e substituicao atomica dos bloqueios. O painel abre mensagem pronta com a nova data e horario para a Maira revisar e enviar.
- Reservas confirmadas tem o atalho **Enviar lembrete**, que abre a mensagem no WhatsApp para revisao e envio manual pela Maira.
- O menu principal oferece o botao **Entrar** alinhado a direita; em telas estreitas, os links rolam sem ocultar esse botao.
- Os controles de semana da agenda administrativa foram ajustados para manter **Proxima semana** visivel em telas de 320 px.

## Proximos passos

1. A proprietaria testar em producao o fluxo de escolha da profissional, disponibilidade separada e uma reserva real.
2. Conferir no painel a exibição de reservas no mesmo horario, filtragem por profissional e reagendamento.
3. Confirmar no celular o atalho para a agenda e a abertura das mensagens prontas no WhatsApp.

## Nao definido ainda

- Como arquivar ou remover profissionais sem alterar o historico das reservas.
- Campos adicionais alem de nome e WhatsApp.
- Politica de cancelamento.
- Prazo minimo para agendar.
- Prazo minimo para cancelar ou remarcar.
- Uso de pagamento antecipado.
- Politica de expiracao para pedidos pendentes.
