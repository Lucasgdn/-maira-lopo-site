# Plano da versao 3.0

## Situacao atual

Este documento registra ideias e proximas etapas; a versao 3.0 ainda nao esta
concluida. A primeira etapa prepara o pareamento do WhatsApp no terminal do
servidor, sem integrar a agenda nem enviar mensagens. Atualmente a agenda usa
Firebase e identifica a profissional de cada reserva. No painel, o lembrete
abre uma mensagem pronta para a Maira revisar e enviar; nao ha envio automatico.
O pareamento real ainda nao foi validado. A primeira biblioteca de conexao
foi substituida pela alternativa WPPConnect. O robo tambem usa Firebase para
se comunicar com o painel; a auditoria ainda aponta alertas transitivos do
Firebase. Nao usar em producao antes de validar a conexao e a operacao.

## Objetivo

Criar um robo integrado a agenda para enviar lembretes de agendamentos e
resumos diarios por WhatsApp, usando inicialmente o numero da esmalteria.
O robo sera um processo separado do site, executado em um servidor.

## Lembretes para clientes

- Consultar as reservas confirmadas e preparar uma mensagem com servico,
  profissional, data e horario.
- Enviar pelo numero da esmalteria no prazo que for escolhido.
- Antes do envio, verificar novamente se a reserva continua confirmada e se
  data e horario nao mudaram.
- Registrar a situacao de cada envio e evitar duplicacoes, inclusive apos
  reinicios e reagendamentos. Em caso de resultado incerto, nao presumir que
  a mensagem foi entregue nem repetir cegamente.
- Definir como informar as clientes sobre os lembretes e respeitar sua
  preferencia de recebimento.

## Resumo diario

- Separar os atendimentos confirmados por profissional, mostrando horario,
  cliente e servico.
- Na primeira etapa funcional, configurar um numero para receber a agenda de
  todas, agrupada por profissional. No futuro, permitir tambem um numero por
  profissional para receber somente a propria agenda.
- Usar o numero da esmalteria como remetente nas duas opcoes. Usar numeros
  diferentes como remetentes exigiria conexoes separadas e fica fora da etapa
  inicial.
- O resumo representa a agenda no momento do envio. Avisos de mudancas
  posteriores ainda precisam ser definidos.

## Conexao e hospedagem

- Conectar o numero existente da esmalteria pelo QR code de dispositivos
  conectados do WhatsApp, exibido no painel administrativo protegido.
- Essa abordagem usa integracao nao oficial: pode deixar de funcionar apos
  atualizacoes e traz risco de restricao ou bloqueio do numero. Nao ha garantia
  de funcionamento permanente.
- O processo precisa ficar ligado e conectado, detectar desconexoes e permitir
  reconexao. Exibir no painel o estado da conexao e as falhas relevantes.
- Considerar uma maquina virtual gratuita na Oracle Cloud enquanto o servidor
  proprio nao estiver pronto. A disponibilidade e os limites do plano devem ser
  verificados; o cadastro geralmente exige cartao. Depois, o processo podera ser
  migrado para o servidor proprio, possivelmente exigindo novo pareamento.
- GitHub pode guardar o codigo e Vercel hospedar o site, mas nao sao a escolha
  para manter este processo continuamente conectado.
- Buscar ferramentas gratuitas, lembrando que energia, internet e eventuais
  limites dos servicos podem ter custos.

O codigo inicial fica em `robo-whatsapp/`, com dependencias independentes das
do site e requer Node.js 22.12 ou superior. A configuracao da conta restrita e
das regras esta descrita em `FIREBASE-SETUP.md`. A sessao local exige
armazenamento persistente; ela nao deve ser compartilhada ou adicionada ao Git.

## Seguranca e privacidade

- O QR code, a sessao do WhatsApp e as credenciais do robo devem ficar
  protegidos. Nao publica-los no repositorio, em logs ou em paginas publicas.
  O QR temporario fica no Firestore com acesso restrito; a sessao local pode
  conter historico e outros dados do WhatsApp.
- O documento `settings/availability` e publico; nao armazenar nele os
  numeros particulares nem outros dados privados da configuracao.
- Usar armazenamento privado e acesso restrito as administradoras autorizadas
  para os destinatarios, a configuracao e o estado do robo. Definir separadamente
  as permissoes minimas da identidade usada pelo servidor.
- Evitar expor dados de clientes em logs e limitar seu armazenamento ao
  necessario.
- Durante o desenvolvimento, nao criar reservas reais de teste nem enviar
  mensagens a clientes. A validacao real fica para a proprietaria.

## Etapas propostas

1. Preparar o processo separado e o pareamento por QR no painel,
   sem enviar mensagens nem consultar a agenda.
2. Definir as regras de lembrete e de resumo, destinatario e preferencias das
   clientes; preparar no painel uma configuracao privada, sem ativar envios.
3. Integrar o robo a agenda, ao painel e ao registro de estado e envios.
4. Validar com dados simulados, incluindo cancelamentos, reagendamentos,
   desconexoes e resultados de envio incertos.
5. Configurar a hospedagem e permitir que a proprietaria faca a validacao real
   antes de ativar os envios.

## Decisoes em aberto

- Antecedencia, horario e texto dos lembretes para clientes.
- Horario, texto e comportamento do resumo quando nao houver atendimentos.
- Se e como avisar alteracoes feitas depois do resumo.
- Como tratar mensagens vencidas durante uma queda ou ausencia de conexao.
- Regras de preferencia das clientes, autorizacao dos destinatarios e retencao
  dos registros.
- Detalhes da hospedagem temporaria e validacao real do QR e da desconexao.

## Melhorias futuras

- Contas individuais para profissionais configurarem seu proprio numero.
- Possibilidade de oferecer planos mensais com funcionalidades diferentes,
  como um destinatario para a loja ou destinatarios individuais. Cobranca,
  planos e liberacao de funcionalidades nao fazem parte da etapa atual.
- Transformar o sistema em white label para saloes e barbearias, com nome e
  identidade visual proprios e uma agenda para cada estabelecimento.
- Criar um painel do dono da plataforma para cadastrar estabelecimentos,
  acompanhar assinaturas e definir planos e funcionalidades liberadas.
  Inicialmente, a administracao dos planos poderia ser manual; cobranca
  automatica seria uma etapa posterior.
- Cada estabelecimento teria sua propria conexao de WhatsApp, profissionais,
  servicos e clientes. Exigir separacao de dados e permissoes entre empresas e
  perfis de acesso adequados; o projeto atual atende uma unica esmalteria.
- Antes de vender em escala, avaliar a API oficial do WhatsApp, seus custos e
  regras, pois a integracao nao oficial pode sofrer bloqueios ou interrupcoes.
- Revisar a licenca da biblioteca WPPConnect e suas obrigacoes antes de
  disponibilizar ou distribuir uma versao comercial.
