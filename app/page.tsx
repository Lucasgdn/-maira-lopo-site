"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const imagens = [
    "/fotosobre4.jpg",
    "/fotosobre2.jpg",
    "/fotosobre3.jpg",
    "/fotosobre1.jpg",
  ];

  const [indexAtual, setIndexAtual] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndexAtual((prev) => (prev + 1) % imagens.length);
    }, 7000);

    return () => clearInterval(timer);
  }, [imagens.length]);

  const proximo = () => {
    setIndexAtual((prev) => (prev + 1) % imagens.length);
  };

  const anterior = () => {
    setIndexAtual((prev) =>
      prev === 0 ? imagens.length - 1 : prev - 1
    );
  };

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
        <div className="absolute inset-0 bg-[#f5ebe0]/80"></div>

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

      {/* CARROSSEL DE FOTOS */}
      {/* CARROSSEL DE FOTOS */}
<section className="py-10 px-6">
  <div className="max-w-5xl mx-auto flex flex-col items-center">

    <div className="relative rounded-2xl shadow-lg overflow-hidden bg-white">
      <img
        src={imagens[indexAtual]}
        alt="Espaço Maira Lopo"
        className="max-h-[520px] w-auto object-contain transition-opacity duration-700"
      />

      {/* SETAS */}
      <button
        onClick={anterior}
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-3 shadow hover:bg-white"
      >
        ⟨
      </button>

      <button
        onClick={proximo}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-3 shadow hover:bg-white"
      >
        ⟩
      </button>
    </div>

    {/* PONTINHOS */}
    <div className="flex justify-center gap-3 mt-6">
      {imagens.map((_, i) => (
        <button
          key={i}
          onClick={() => setIndexAtual(i)}
          className={`w-3 h-3 rounded-full ${
            i === indexAtual
              ? "bg-[#7a6a5a]"
              : "bg-[#d6ccc2]"
          }`}
        />
      ))}
    </div>

  </div>
</section>
      {/* SOBRE */}
      <section id="sobre" className="py-12 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold">Sobre a Maira Lopo</h2>

          <p className="mt-6 text-[#5c5c5c] leading-relaxed">
            Comecei minha trajetória na área da beleza aos 16 anos, quando fiz meu primeiro curso de manicure. Desde então, sigo avançando passo a passo, sempre com muita dedicação, amor pelo que faço e vontade constante de evoluir.
            Com o tempo, me especializei em Nail Design e cuticulagem russa — áreas que exigem alta precisão, paciência e técnica, características que refletem diretamente o meu propósito profissional. Para desenvolver firmeza e sensibilidade, cheguei a treinar utilizando ovos: com o motor, removia apenas a camada externa da casca, preservando a película interna. Esse processo, embora desafiador, foi essencial para alcançar o nível de controle, cuidado e excelência que aplico hoje em cada detalhe.
            Cada unha que realizo carrega minha história, meu esforço e o carinho presente em todo o processo. Meu objetivo vai além da estética: é entregar autoestima, confiança e um atendimento de alto padrão em cada experiência.
          </p>

          <p className="mt-4 text-[#5c5c5c] leading-relaxed">
            Cada detalhe foi cuidadosamente pensado para oferecer conforto, exclusividade e um atendimento humano.
          </p>

          <p className="mt-4 text-[#5c5c5c] leading-relaxed">
            Hoje, a Maira Lopo é referência em qualidade, segurança e carinho.
          </p>
        </div>
      </section>

      {/* SERVIÇOS */}
      <section id="servicos" className="py-28 px-6 bg-white text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold">Serviços</h2>
          <p className="mt-4 text-[#5c5c5c] leading-relaxed">
            Oferecemos manicure, unhas em gel, alongamento, decoração
            personalizada, cuticulagem russa e cuidados especiais para
            manter suas mãos e pés sempre impecáveis.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3 text-left">
            <div className="rounded-3xl border border-[#e6d8ce] p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Manicure & Pedicure</h3>
              <p className="mt-3 text-[#5c5c5c]">
                Tratamento completo com atenção aos detalhes, hidratação e
                acabamento perfeito.
              </p>
            </div>
            <div className="rounded-3xl border border-[#e6d8ce] p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Alongamento</h3>
              <p className="mt-3 text-[#5c5c5c]">
                Alongamento em gel e fibra para unhas naturais, resistentes e
                elegantes.
              </p>
            </div>
            <div className="rounded-3xl border border-[#e6d8ce] p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Nail Design</h3>
              <p className="mt-3 text-[#5c5c5c]">
                Arte personalizada com estilos sofisticados, modernos e
                exclusivos para cada cliente.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* EXPERIÊNCIA */}
      <section id="experiencia" className="py-28 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold">Experiência</h2>
          <p className="mt-4 text-[#5c5c5c] leading-relaxed">
            Mais de anos de dedicação e especialização em técnicas de
            manicure, alongamento e cuidados com unhas. Cada atendimento é
            pensado para trazer conforto, confiança e resultados impecáveis.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3 text-left">
            <div className="rounded-3xl border border-[#e6d8ce] p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Qualificação</h3>
              <p className="mt-3 text-[#5c5c5c]">
                Cursos avançados em Nail Design e cuticulagem russa, com foco
                em qualidade e segurança.
              </p>
            </div>
            <div className="rounded-3xl border border-[#e6d8ce] p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Atendimento</h3>
              <p className="mt-3 text-[#5c5c5c]">
                Atendimento personalizado em ambiente acolhedor, pensado para
                relaxar e se sentir especial.
              </p>
            </div>
            <div className="rounded-3xl border border-[#e6d8ce] p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Resultados</h3>
              <p className="mt-3 text-[#5c5c5c]">
                Experiência comprovada com clientes que saem satisfeitas e
                renovadas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AGENDAMENTO */}
      <section id="agendamento" className="py-28 bg-[#efe7df] px-6 text-center">
        <h2 className="text-3xl font-bold">Agende seu horário</h2>

        <p className="mt-4 text-[#5c5c5c]">
          Consulte horários disponíveis pelo WhatsApp.
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
