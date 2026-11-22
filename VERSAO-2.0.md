# Plano da versao 2.0

## Situacao atual

A versao publicada continua na versao 1.0. O codigo local ja substitui os links de agendamento por uma agenda propria, mas o fluxo so podera receber pedidos depois de publicar as regras atualizadas do Firestore e fazer o deploy do site.

## Objetivo da versao 2.0

Criar uma agenda integrada ao site com procedimentos, duracoes, precos, profissionais, datas, horarios e confirmacao pelo WhatsApp.

O painel administrativo em `/admin` usa Firebase Authentication, e-mail e senha, verifica uma lista de administradores no Firestore e oferece uma agenda semanal inspirada no Outlook, com eventos de bloqueio, configuracao da rotina por dia da semana e reservas de clientes com atalho para WhatsApp. O passo a passo esta em [FIREBASE-SETUP.md](./FIREBASE-SETUP.md).

Os cards ja abrem um calendario publico com dias e horarios calculados a partir da disponibilidade do Firestore. Cada servico informa sua propria duracao; os inicios sao oferecidos a cada 15 minutos e o bloqueio usa o tempo exato em intervalos internos de 5 minutos. Reservas concorrentes sao protegidas por transacoes do Firestore.

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
2. O calendario mostra dias e horarios compativeis com a agenda, bloqueios e duracao do servico.
3. A cliente informa nome e WhatsApp obrigatorios.
4. O pedido fica como pendente e ocupa os intervalos para evitar conflito.
5. A Maira ve a reserva no painel, inicia uma conversa pelo WhatsApp e confirma ou cancela o pedido.

### Disponibilidade definida pela profissional

Ela tera um painel administrativo protegido por login para:

- Definir os dias da semana em que atende.
- Definir os primeiros e ultimos horarios de atendimento.
- Criar intervalos de trabalho, como almoco ou pausas.
- Bloquear feriados e dias inteiros.
- Bloquear horarios individuais.
- Registrar horarios ocupados por atendimentos feitos fora do site.
- Visualizar agendamentos pendentes e confirmados, tambem na agenda semanal.
- Confirmar ou cancelar reservas e liberar o horario ao cancelar.
- Usar a agenda da profissional que tiver disponibilidade.

Exemplo de configuracao:

- Segunda a sexta: 09:00 as 18:00.
- Almoco: 12:00 as 13:00.
- Sabado: 09:00 as 13:00.
- Duracao excedida pelo procedimento: o sistema ocupa o intervalo inteiro.

## Controle de horarios

A versao 2.0 usara Firebase:

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

- Versao atual: 1.0.
- Versao planejada: 2.0.
- O fluxo local so sera ativado publicamente depois da publicacao das regras atualizadas do Firestore e do deploy do site.
- O identificador da versao deve ser exibido discretamente no sistema e centralizado em uma constante.

## Proximos passos

1. Revisar se os servicos, duracoes e precos dos cards estao corretos.
2. Conferir os dias, horarios e intervalos no painel.
3. Publicar as regras atualizadas no Firebase.
4. Testar uma reserva, um conflito simultaneo, um bloqueio e um cancelamento no Firebase real.
5. Fazer deploy do site quando os testes forem aprovados.

## Nao definido ainda

- Quantidade de profissionais e se a cliente deve escolher quem atende.
- Campos adicionais alem de nome e WhatsApp.
- Politica de cancelamento.
- Prazo minimo para agendar.
- Prazo minimo para cancelar ou remarcar.
- Uso de pagamento antecipado.
- Politica de expiracao para pedidos pendentes.
