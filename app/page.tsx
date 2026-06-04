"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const imagens = [
    "/fotosobre4.jpg",
    "/fotosobre2.jpg",
    "/fotosobre5.jpg",
    "/fotosobre3.jpg",
    "/fotosobre1.jpg",
  ];

  const [indexAtual, setIndexAtual] = useState(0);
  const [indexServicosCarousel, setIndexServicosCarousel] = useState(0);
  const [indexExperiencia, setIndexExperiencia] = useState(0);
  const [indexRevista, setIndexRevista] = useState(0);

  const servicosCarousel = [
    {
      src: "/alomgamentodeunha1.jpeg",
      titles: ["Alongamento de unhas"],
    },
    {
      src: "/alongamentodeunha2.jpeg",
      titles: ["Alongamento de unhas"],
    },
    {
      src: "/cuticularussaemgel.jpeg",
      titles: ["Cuticulagem russa + esmaltação em gel"],
    },
    {
      src: "/emgelpedicure.jpeg",
      titles: ["Esmaltação em gel + pedicure"],
    },
    {
      src: "/esmaltacaoemgel1.jpeg",
      titles: ["Esmaltação em gel"],
    },
    {
      src: "/esmaltacaoemgel2.jpeg",
      titles: ["Esmaltação em gel"],
    },
    {
      src: "/pedicuregel.jpeg",
      titles: ["Pedicure em gel"],
    },
    {
      src: "/pedicuretradicional.jpeg",
      titles: ["Pedicure tradicional"],
    },
  ];

  const servicos = [
    {
      title: "Manicure & Pedicure",
      descricao:
        "Tratamento completo com atenção aos detalhes, hidratação e acabamento perfeito.",
    },
    {
      title: "Alongamento",
      descricao:
        "Alongamento em gel e fibra para unhas naturais, resistentes e elegantes.",
    },
    {
      title: "Nail Design",
      descricao:
        "Arte personalizada com estilos sofisticados, modernos e exclusivos para cada cliente.",
    },
  ];

  const experiencias = [
    {
      src: "/ambiente1.jpg",
      title: "Qualificação",
    },
    {
      src: "/ambiente2.jpg",
      title: "Atendimento",
    },
    {
      src: "/ambiente3.jpg",
      title: "Resultados",
    },
  ];

  const revista = [
    "/revista_pagina_01.jpg",
    "/revista_pagina_02.jpg",
    "/revista_pagina_03.jpg",
    "/revista_pagina_04.jpg",
    "/revista_pagina_05.jpg",
    "/revista_pagina_06.jpg",
    "/revista_pagina_07.jpg",
    "/revista_pagina_08.jpg",
    "/revista_pagina_09.jpg",
    "/revista_pagina_10.jpg",
    "/revista_pagina_11.jpg",
    "/revista_pagina_12.jpg",
    "/revista_pagina_13.jpg",
    "/revista_pagina_14.jpg",
    "/revista_pagina_15.jpg",
    "/revista_pagina_16.jpg",
    "/revista_pagina_17.jpg",
    "/revista_pagina_18.jpg",
    "/revista_pagina_19.jpg",
    "/revista_pagina_20.jpg",
  ];

  const precos: Array<{ servico: string; preco: string; promocao?: string }> = [
    { servico: "Mão", preco: "R$ 35,00" },
    { servico: "Pé", preco: "R$ 40,00" },
    { servico: "Mão e Pé", preco: "R$ 75,00" },
    { servico: "Esmaltação em Gel", preco: "R$ 110,00" },
    { servico: "Unhas Postiças Realistas", preco: "R$ 65,00" },
    { servico: "Banho de Gel", preco: "R$ 100,00" },
    { servico: "Alongamento", preco: "R$ 190,00" },
    { servico: "Manutenção de Alongamento", preco: "R$ 150,00" },
    { servico: "Spa das Mãos", preco: "R$ 35,00" },
    { servico: "Spa Terapêutico", preco: "R$ 80,00" },
    { servico: "Peeling de Calosidade", preco: "R$ 75,00" },
    { servico: "Escalda Pés", preco: "R$ 35,00" },
    { servico: "Esmaltação Tradicional Mão/Pé", preco: "R$ 20,00" },
    { servico: "Blindagem", preco: "R$ 75,00" },
  ];

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

  const proximoServicosCarousel = () => {
    setIndexServicosCarousel((prev) => (prev + 1) % servicosCarousel.length);
  };

  const anteriorServicosCarousel = () => {
    setIndexServicosCarousel((prev) =>
      prev === 0 ? servicosCarousel.length - 1 : prev - 1
    );
  };

  const proximoExperiencia = () => {
    setIndexExperiencia((prev) => (prev + 1) % experiencias.length);
  };

  const anteriorExperiencia = () => {
    setIndexExperiencia((prev) =>
      prev === 0 ? experiencias.length - 1 : prev - 1
    );
  };

  const proximoRevista = () => {
    setIndexRevista((prev) => (prev + 1) % revista.length);
  };

  const anteriorRevista = () => {
    setIndexRevista((prev) => (prev === 0 ? revista.length - 1 : prev - 1));
  };

  const handleNavClick = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const nav = document.querySelector("nav");
    const navHeight = nav ? (nav.getBoundingClientRect().height) : 80;
    const top = el.getBoundingClientRect().top + window.scrollY - navHeight - 8;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <main className="bg-[#f5ebe0] text-[#3e3e3e] relative scroll-smooth" style={{ scrollPaddingTop: '80px' }}>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full bg-[#f5ebe0]/90 backdrop-blur-md shadow-sm z-50">
        <div className="flex gap-6 py-4 text-sm md:text-base overflow-x-auto whitespace-nowrap px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <a href="#inicio" onClick={(e) => handleNavClick(e, 'inicio')} className="inline-block px-3 hover:text-black">Início</a>
          <a href="#sobre" onClick={(e) => handleNavClick(e, 'sobre')} className="inline-block px-3 hover:text-black">Sobre</a>
          <a href="#servicos" onClick={(e) => handleNavClick(e, 'servicos')} className="inline-block px-3 hover:text-black">Serviços</a>
          <a href="#experiencia" onClick={(e) => handleNavClick(e, 'experiencia')} className="inline-block px-3 hover:text-black">Experiência</a>
          <a href="#revista" onClick={(e) => handleNavClick(e, 'revista')} className="inline-block px-3 hover:text-black">Revista</a>
          <a href="#precos" onClick={(e) => handleNavClick(e, 'precos')} className="inline-block px-3 hover:text-black">Preços</a>
          <a href="#agendamento" onClick={(e) => handleNavClick(e, 'agendamento')} className="inline-block px-3 hover:text-black">Agendamento</a>
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
          scrollMarginTop: '80px',
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
            href="https://dottovip.com.br/mairalopoesmaltaria"
            target="_blank"
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
      <section id="sobre" className="py-12 px-6 text-center" style={{ scrollMarginTop: '80px' }}>
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
      <section id="servicos" className="py-28 px-6 bg-white text-center" style={{ scrollMarginTop: '80px' }}>
        <div className="max-w-5xl mx-auto flex flex-col items-center">
          <h2 className="text-3xl font-bold">Serviços</h2>
          <p className="mt-4 text-[#5c5c5c] leading-relaxed max-w-2xl">
            Oferecemos serviços pensados para realçar sua beleza com conforto, segurança e resultado impecável.
          </p>

          <div className="relative mt-10 rounded-2xl shadow-lg overflow-hidden bg-white">
            <img
              src={servicosCarousel[indexServicosCarousel].src}
              alt={servicosCarousel[indexServicosCarousel].titles.join(", ")}
              className="w-full max-h-[520px] object-contain"
            />

            <div className="absolute inset-x-0 bottom-0 bg-black/50 p-6 text-left text-white">
              <ul className="space-y-2 text-sm md:text-base">
                {servicosCarousel[indexServicosCarousel].titles.map((item) => (
                  <li key={item} className="list-disc pl-4">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={anteriorServicosCarousel}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-3 shadow hover:bg-white"
            >
              ⟨
            </button>

            <button
              onClick={proximoServicosCarousel}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-3 shadow hover:bg-white"
            >
              ⟩
            </button>
          </div>

          <div className="flex justify-center gap-3 mt-6">
            {servicosCarousel.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndexServicosCarousel(i)}
                className={`h-3 w-3 rounded-full ${
                  i === indexServicosCarousel ? "bg-[#7a6a5a]" : "bg-[#d6ccc2]"
                }`}
              />
            ))}
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {servicos.map((servico) => (
              <div
                key={servico.title}
                className="rounded-3xl border border-[#e5d7cb] bg-[#fffaf5] px-6 py-8 text-left shadow-sm"
              >
                <h3 className="text-2xl font-semibold mb-4">
                  {servico.title}
                </h3>
                <p className="text-[#5c5c5c] leading-relaxed">
                  {servico.descricao}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXPERIÊNCIA */}
      <section id="experiencia" className="py-28 px-6 text-center" style={{ scrollMarginTop: '80px' }}>
        <div className="max-w-5xl mx-auto flex flex-col items-center">
          <h2 className="text-3xl font-bold">Experiência</h2>
          <p className="mt-4 text-[#5c5c5c] leading-relaxed max-w-2xl">
            Cada etapa do atendimento é feita com cuidado e técnica, para que você saia mais confiante e satisfeita.
          </p>

          <div className="relative mt-10 rounded-2xl shadow-lg overflow-hidden bg-white">
            <img
              src={experiencias[indexExperiencia].src}
              alt={experiencias[indexExperiencia].title}
              className="w-full max-h-[520px] object-cover"
            />

            <button
              onClick={anteriorExperiencia}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-3 shadow hover:bg-white"
            >
              ⟨
            </button>

            <button
              onClick={proximoExperiencia}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-3 shadow hover:bg-white"
            >
              ⟩
            </button>
          </div>

          <div className="flex justify-center gap-3 mt-6">
            {experiencias.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndexExperiencia(i)}
                className={`h-3 w-3 rounded-full ${
                  i === indexExperiencia ? "bg-[#7a6a5a]" : "bg-[#d6ccc2]"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* REVISTA */}
      <section id="revista" className="py-14 md:py-20 px-6 bg-[#fffaf5] text-center" style={{ scrollMarginTop: '80px' }}>
        <div className="max-w-xl md:max-w-3xl mx-auto flex flex-col items-center">
          <h2 className="text-xl md:text-2xl font-bold">Revista</h2>
          <p className="mt-1 text-sm text-[#5c5c5c] leading-relaxed max-w-xl">
            Navegue pelas páginas usando as setas ou os indicadores abaixo.
          </p>

          <div className="relative mt-6 rounded-2xl shadow-lg overflow-hidden bg-white w-full flex items-center justify-center">
            <img
              src={revista[indexRevista]}
              alt={`Revista página ${indexRevista + 1}`}
              className="w-full h-auto max-w-[320px] sm:max-w-[520px] md:max-w-[720px] object-contain mx-auto"
            />

            <button
              onClick={anteriorRevista}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white"
              aria-label="Página anterior"
            >
              ⟨
            </button>

            <button
              onClick={proximoRevista}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 shadow hover:bg-white"
              aria-label="Próxima página"
            >
              ⟩
            </button>
          </div>

          <div className="flex items-center gap-3 mt-3 text-sm">
            <span className="text-[#5c5c5c]">Página</span>
            <span className="font-semibold text-[#7a6a5a]">{indexRevista + 1} / {revista.length}</span>
          </div>

          <div className="flex justify-center gap-2 mt-3">
            {revista.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndexRevista(i)}
                className={`w-2 h-2 rounded-full ${
                  i === indexRevista ? "bg-[#7a6a5a]" : "bg-[#d6ccc2]"
                }`}
                aria-label={`Ir para página ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* PREÇOS */}
      <section id="precos" className="py-28 px-6 bg-white text-center" style={{ scrollMarginTop: '80px' }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold">Tabela de Preços</h2>
          <p className="mt-4 text-[#5c5c5c] leading-relaxed">
            Conheça nossos valores e escolha o serviço perfeito para você.
          </p>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#7a6a5a] text-white">
                  <th className="px-6 py-4 text-left font-semibold">Serviço</th>
                  <th className="px-6 py-4 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {precos.map((item, index) => (
                  <tr
                    key={index}
                    className={`border-b border-[#e5d7cb] ${
                      index % 2 === 0 ? "bg-[#fffaf5]" : "bg-white"
                    } hover:bg-[#f5ebe0] transition`}
                  >
                    <td className="px-6 py-4 text-left text-[#3e3e3e]">
                      {item.servico}
                    </td>
                    <td className="px-6 py-4 text-right text-[#7a6a5a] font-semibold">
                      {item.promocao ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-green-600">{item.preco}</span>
                          <span className="text-sm line-through text-gray-400">{item.promocao}</span>
                        </div>
                      ) : (
                        item.preco
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-8 text-sm text-[#5c5c5c]">
            💡 <strong>Dica:</strong> Combos e promoções disponíveis. Consulte pelo WhatsApp para detalhes!
          </p>
        </div>
      </section>

      {/* AGENDAMENTO */}
      <section id="agendamento" className="py-28 bg-[#efe7df] px-6 text-center" style={{ scrollMarginTop: '80px' }}>
        <h2 className="text-3xl font-bold">Agende seu horário</h2>

        <p className="mt-4 text-[#5c5c5c]">
          Consulte horários disponíveis pelo WhatsApp.
        </p>

        <a
          href="https://dottovip.com.br/mairalopoesmaltaria"
          target="_blank"
          className="inline-block mt-8 bg-green-500 text-white px-8 py-4 rounded-full shadow-md hover:scale-105 transition"
        >
          Agendar agora
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
