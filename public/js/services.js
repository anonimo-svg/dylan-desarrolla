(() => {
  const container = document.getElementById('serviceRows');
  if (!container) return;

  const phone = '5493535669489';
  const formatARS = (value) => new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0
  }).format(value);

  function makeSpan(className, text) {
    const el = document.createElement('span');
    if (className) el.className = className;
    el.textContent = text;
    return el;
  }

  function createServiceRow(service, index) {
    const row = document.createElement('a');
    row.className = 'row';
    row.target = '_blank';
    row.rel = 'noopener noreferrer';

    const quoteText = service.quote || service.price === null
      ? `Hola, quisiera solicitar un presupuesto para ${service.title}.`
      : `Hola, quisiera consultar por ${service.title} por AR$ ${formatARS(service.price)}.`;
    row.href = `https://wa.me/${phone}?text=${encodeURIComponent(quoteText)}`;
    row.setAttribute('aria-label', `Consultar por ${service.title} por WhatsApp`);
    row.append(makeSpan('row-num', `${String(index + 1).padStart(2, '0')} /`));

    const title = document.createElement('h3');
    title.textContent = service.title;
    row.append(title);

    const description = document.createElement('p');
    description.textContent = service.description;
    row.append(description);

    const price = document.createElement('span');
    price.className = 'price';
    if (service.quote || service.price === null) {
      price.classList.add('quote');
      price.textContent = 'Solicitar presupuesto';
    } else {
      price.textContent = `AR$ ${formatARS(service.price)}`;
    }
    row.append(price, makeSpan('arrow', '↗'));
    row.lastChild.setAttribute('aria-hidden', 'true');
    return row;
  }

  async function loadServices() {
    try {
      const response = await fetch('/api/services', { cache: 'no-store' });
      if (!response.ok) throw new Error('No se pudieron cargar los servicios.');
      const services = await response.json();
      if (!Array.isArray(services) || services.length === 0) throw new Error('No hay servicios configurados.');
      const fragment = document.createDocumentFragment();
      services.forEach((service, index) => fragment.append(createServiceRow(service, index)));
      container.replaceChildren(fragment);
    } catch (error) {
      const message = document.createElement('p');
      message.className = 'service-load-error';
      message.textContent = 'No se pudieron cargar los servicios. Probá actualizar la página o volvé a consultar más tarde.';
      container.replaceChildren(message);
      console.error(error);
    }
  }

  loadServices();
})();
