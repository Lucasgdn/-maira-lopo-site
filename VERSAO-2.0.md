# Plano da versao 2.0

## Situacao atual

A versao 2.0 da agenda propria esta publicada. As regras do Firestore e o deploy do site ja foram atualizados. Foram verificados o build, a exibicao publica da ajuda, a versao nos rodapes e os links contextualizados para o WhatsApp. Ainda falta validar em producao, de ponta a ponta, uma reserva real, um conflito simultaneo, um bloqueio e um cancelamento.

## Objetivo da versao 2.0

Criar uma agenda integrada ao site com procedimentos, duracoes, precos, profissionais, datas, horarios e confirmacao pelo WhatsApp.

O painel administrativo em `/admin` usa Firebase Authentication, e-mail e senha, verifica uma lista de administradores no Firestore e oferece uma agenda semanal inspirada no Outlook, com eventos de bloqueio, configuracao da rotina por dia da semana e reservas de clientes. Confirmar ou cancelar uma reserva atualiza a agenda e abre uma mensagem pronta no WhatsApp para a Maira revisar e enviar. Se a abertura automatica for bloqueada, o painel apresenta um link alternativo.

Os cards ja abrem um calendario publico com dias e horarios calculados a partir da disponibilidade do Firestore. Cada servico informa sua propria duracao; os inicios sao oferecidos a cada 15 minutos e o bloqueio usa o tempo exato em intervalos internos de 5 minutos. Reservas concorrentes sao protegidas por transacoes do Firestore. O site e o painel mostram instrucoes de ajuda e permitem relatar problemas pelo WhatsApp da Maira, com mensagens iniciais diferentes conforme a origem.

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
5. A Maira ve a reserva no painel e pode confirma-la ou cancela-la; cada acao atualiza a agenda e prepara uma mensagem correspondente no WhatsApp.

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
- O menu principal oferece o botao **Entrar** alinhado a direita; em telas estreitas, os links rolam sem ocultar esse botao.
- Os controles de semana da agenda administrativa foram ajustados para manter **Proxima semana** visivel em telas de 320 px.

## Proximos passos

1. Revisar se os servicos, duracoes e precos dos cards estao corretos.
2. Conferir os dias, horarios e intervalos no painel.
3. Testar em producao uma reserva, um conflito simultaneo, um bloqueio e um cancelamento no Firebase real.
4. Verificar no celular o acesso ao WhatsApp e o comportamento caso o navegador bloqueie a abertura de uma nova aba.

## Nao definido ainda

- Quantidade de profissionais e se a cliente deve escolher quem atende.
- Campos adicionais alem de nome e WhatsApp.
- Politica de cancelamento.
- Prazo minimo para agendar.
- Prazo minimo para cancelar ou remarcar.
- Uso de pagamento antecipado.
- Politica de expiracao para pedidos pendentes.
