export default function Home() {
  return (
    <main className="bg-[#f5ebe0] text-[#3e3e3e] relative scroll-smooth">

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full bg-[#f5ebe0]/90 backdrop-blur-md shadow-sm z-50">
        <div className="flex justify-center gap-6 py-4 text-sm md:text-base">
          <a href="#inicio" className="hover:text-black">Início</a>
          <a href="#sobre" className="hover:text-black">Sobre</a>
          <a href="#servicos" className="hover:text-black">Serviços</a>
          <a href="#experiencia" className="hover:text-black">Experiência</a>
          <a href="#agendamento" className="hover:text-black">Agendamento</a>
        </div>
      </nav>

      {/* HERO */}
      <section
        id="inicio"
        className="h-screen relative flex items-center justify-center px-6 pt-28"
        style={{
          backgroundImage: "url('/foto.jpg')",
          backgroundSize: "40%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 12%",
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-[#f5ebe0]/80"></div>

        {/* Conteúdo */}
        <div className="relative text-center max-w-xl">
          <h1 className="text-5xl font-bold tracking-wide">
            Maira Lopo
          </h1>

          <p className="mt-4 text-xl text-[#7a6a5a]">
            Beleza • Bem-estar • Saúde
          </p>

          <p className="mt-6 text-[#5c5c5c] leading-relaxed">
            Um espaço criado para você desacelerar, cuidar de si e viver
            uma experiência de beleza personalizada, com atenção aos
            detalhes, segurança e acolhimento em cada atendimento.
          </p>

          <a
            href="#agendamento"
            className="inline-block mt-8 bg-[#d6ccc2] px-8 py-4 rounded-full shadow-md hover:scale-105 transition"
          >
            Agendar agora
          </a>
        </div>
      </section>

      {/* SOBRE */}
      <section id="sobre" className="py-28 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold">Sobre a Maira Lopo</h2>

          <p className="mt-6 text-[#5c5c5c] leading-relaxed">
            A Maira Lopo nasceu do sonho de uma mulher apaixonada por
            beleza e autocuidado, que sempre acreditou que a verdadeira
            beleza começa em como nos sentimos.
          </p>

          <p className="mt-4 text-[#5c5c5c] leading-relaxed">
            Cada detalhe foi pensado para oferecer conforto, exclusividade
            e um atendimento humano, onde a cliente se desconecta da rotina
            e foca em seu bem-estar.
          </p>

          <p className="mt-4 text-[#5c5c5c] leading-relaxed">
            Hoje, a Maira Lopo é um verdadeiro refúgio de autocuidado,
            referência em qualidade, segurança e carinho.
          </p>
        </div>
      </section>

      {/* SERVIÇOS */}
      <section id="servicos" className="py-28 bg-[#efe7df] px-6 text-center">
        <h2 className="text-3xl font-bold">Serviços</h2>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-white p-8 rounded-xl shadow">
            <h3 className="font-semibold text-lg">Manicure & Pedicure</h3>
            <p className="mt-3 text-sm text-[#5c5c5c]">
              Cuidados completos focados na saúde das unhas,
              acabamento impecável e durabilidade.
              Todos os serviços incluem cutilagem.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow">
            <h3 className="font-semibold text-lg">Alongamento de Unhas</h3>
            <p className="mt-3 text-sm text-[#5c5c5c]">
              Técnicas como fibra, tip e molde F1, ideais para quem
              deseja unhas longas, resistentes e naturais.
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow">
            <h3 className="font-semibold text-lg">Esmaltação em Gel</h3>
            <p className="mt-3 text-sm text-[#5c5c5c]">
              Brilho intenso, secagem imediata e cores duráveis,
              garantindo um acabamento sofisticado por semanas.
            </p>
          </div>
        </div>
      </section>

      {/* EXPERIÊNCIA */}
      <section id="experiencia" className="py-28 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold">A experiência</h2>

          <p className="mt-6 text-[#5c5c5c] leading-relaxed">
            Desde a chegada, cada cliente é recebida com atenção e
            cuidado. O atendimento é personalizado, os materiais são
            totalmente higienizados e cada etapa é explicada com
            transparência.
          </p>

          <p className="mt-4 text-[#5c5c5c] leading-relaxed">
            Mais do que um procedimento, cada visita é pensada para que
            você se sinta acolhida, confiante e bem cuidada do início ao fim.
          </p>

          <p className="mt-6 text-sm text-[#7a6a5a]">
            Atendimento com horário marcado • Segunda à sexta, das 9h às 19h
          </p>
        </div>
      </section>

      {/* AGENDAMENTO */}
      <section id="agendamento" className="py-28 bg-[#efe7df] px-6 text-center">
        <h2 className="text-3xl font-bold">Agende seu horário</h2>

        <p className="mt-4 text-[#5c5c5c]">
          Consulte horários disponíveis e permita-se viver um momento só seu.
        </p>

        <a
          href="https://wa.me/5519971023894"
          target="_blank"
          className="inline-block mt-8 bg-green-500 text-white px-8 py-4 rounded-full shadow-md hover:scale-105 transition"
        >
          Agendar pelo WhatsApp
        </a>
      </section>

      {/* WHATSAPP FLUTUANTE */}
      <a
        href="https://wa.me/5519971023894"
        target="_blank"
        className="fixed bottom-6 right-6 z-50"
      >
        <span className="absolute inset-0 rounded-full bg-green-500 opacity-70 animate-ping"></span>
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-xl">
          <img
            src="https://cdn-icons-png.flaticon.com/512/733/733585.png"
            alt="WhatsApp"
            className="w-8 h-8"
          />
        </span>
      </a>

    </main>
  );
}