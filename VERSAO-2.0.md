# Plano da versao 2.0

## Situacao atual

A versao atual do site permanece na versao 1.0. O agendamento continua sendo realizado pelo DottoVip e sera substituido pela agenda propria na versao 2.0.

## Objetivo da versao 2.0

Criar uma agenda integrada ao site com procedimentos, duracoes, precos, profissionais, datas, horarios e confirmacao pelo WhatsApp.

## Agenda propria

### Experiencia da cliente

1. A cliente entra no site e acessa a secao de procedimentos.
2. Cada procedimento tera um card com imagem, nome, descricao, duracao e preco.
3. A cliente toca em "Agendar".
4. O sistema mostra as profissionais disponiveis, quando houver mais de uma.
5. A cliente escolhe o dia.
6. O sistema mostra somente horarios realmente disponiveis.
7. A cliente informa nome, WhatsApp e outros dados necessarios.
8. A reserva e registrada.
9. O WhatsApp recebe uma mensagem de confirmacao com o procedimento, profissional, data e horario.

### Disponibilidade definida pela profissional

Ela tera um painel administrativo protegido por login para:

- Definir os dias da semana em que atende.
- Definir os primeiros e ultimos horarios de atendimento.
- Criar intervalos de trabalho, como almoco ou pausas.
- Bloquear feriados e dias inteiros.
- Bloquear horarios individuais.
- Registrar horarios ocupados por atendimentos feitos fora do site.
- Visualizar agendamentos pendentes e confirmados.
- Confirmar, remarcar ou cancelar reservas.
- Escolher sua agenda ou selecionar a agenda de outra profissional.

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
- Firebase Security Rules para impedir alteracoes indevidas.

Cada reserva sera vinculada a:

- Procedimento.
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
- A versao 2.0 nao sera ativada antes da configuracao completa do Firebase.
- O identificador da versao deve ser exibido discretamente no sistema e centralizado em uma constante.

## Proximos passos

1. Confirmar os procedimentos finais, duracoes e precos.
2. Confirmar quantas profissionais farao atendimentos.
3. Confirmar os dias e horarios de atendimento de cada profissional.
4. Confirmar almocos, intervalos e dias nao atendidos.
5. Criar o projeto Firebase.
6. Configurar Authentication e Firestore.
7. Criar as regras de acesso e reservas.
8. Criar os cards de procedimentos.
9. Criar o fluxo publico de agendamento.
10. Criar o painel administrativo da profissional.
11. Testar conflitos simultaneos de horarios.
12. Testar cancelamentos, remarcacoes e bloqueios.
13. Publicar a versao 2.0.

## Nao definido ainda

- Nome e quantidade das profissionais.
- Horarios diarios e intervalos.
- Feriados ou dias bloqueados.
- Campos obrigatorios além de nome e WhatsApp.
- Politica de cancelamento.
- Prazo minimo para agendar.
- Prazo minimo para cancelar ou remarcar.
- Uso de pagamento antecipado.
- Confirmacao manual ou automatica.
