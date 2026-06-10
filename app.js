const API_ENDPOINT = '/api/chat';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';

let conversationHistory = [];
let currentContext = null;
let isLoading = false;

const messagesArea = document.getElementById('messages-area');
const inputBox = document.getElementById('input-box');
const sendBtn = document.getElementById('send-btn');
const suggestionsBar = document.getElementById('suggestions');

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[uh]|<p|<li)(.+)$/gm, '<p>$1</p>')
    .replace(/---/g, '<hr>')
    .trim();
}

function addMessage(role, content, isHTML = false) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'bot' ? '🏔️' : 'You';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (isHTML) {
    bubble.innerHTML = content;
  } else {
    bubble.innerHTML = formatMarkdown(content);
  }

  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesArea.appendChild(div);
  messagesArea.scrollTop = messagesArea.scrollHeight;
  return div;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'message bot typing-indicator';
  div.id = 'typing';
  div.innerHTML = `
    <div class="message-avatar">🏔️</div>
    <div class="bubble">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>`;
  messagesArea.appendChild(div);
  messagesArea.scrollTop = messagesArea.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typing');
  if (t) t.remove();
}

function updateSuggestions(chips) {
  suggestionsBar.innerHTML = '';
  chips.forEach(text => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.textContent = text;
    btn.onclick = () => sendMessage(text);
    suggestionsBar.appendChild(btn);
  });
}

async function fetchWeather(lat, lon) {
  try {
    const url = `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,precipitation&timezone=Asia/Kolkata`;
    const res = await fetch(url);
    const data = await res.json();
    return {
      temp_c: Math.round(data.current?.temperature_2m),
      condition: decodeWeatherCode(data.current?.weathercode),
      rain_mm: data.current?.precipitation,
    };
  } catch {
    return null;
  }
}

function decodeWeatherCode(code) {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 49) return 'Foggy / hazy';
  if (code <= 59) return 'Drizzle';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 82) return 'Rain showers';
  return 'Thunderstorms';
}

async function buildTravelContext() {
  const source = document.getElementById('source-city').value.trim();
  const dest = document.getElementById('dest-input').value.trim();
  const startDate = document.getElementById('start-date').value;
  const endDate = document.getElementById('end-date').value;
  const groupSize = document.getElementById('group-size').value;
  const budget = document.getElementById('budget').value;

  const ctx = {
    source_city: source || 'Not specified',
    destinations: dest ? [dest] : [],
    travel_dates: { start: startDate || 'Not specified', end: endDate || 'Not specified' },
    group_size: groupSize || '2',
    budget_category: budget || 'mid-range',
    live_weather: {},
  };

  const DEST_COORDS = {
    haridwar: { lat: 29.9457, lon: 78.1642 },
    rishikesh: { lat: 30.0869, lon: 78.2676 },
    mussoorie: { lat: 30.4598, lon: 78.0644 },
    nainital: { lat: 29.3919, lon: 79.4542 },
    dehradun: { lat: 30.3165, lon: 78.0322 },
    auli: { lat: 30.5229, lon: 79.5608 },
    kedarnath: { lat: 30.7352, lon: 79.0669 },
    badrinath: { lat: 30.7433, lon: 79.4938 },
    jim_corbett: { lat: 29.5300, lon: 78.7747 },
    valley_of_flowers: { lat: 30.7280, lon: 79.6050 },
    chopta: { lat: 30.4500, lon: 79.2166 },
  };

  const destKey = dest.toLowerCase().replace(/\s+/g, '_');
  const coords = DEST_COORDS[destKey] || DEST_COORDS['rishikesh'];
  const weather = await fetchWeather(coords.lat, coords.lon);
  if (weather) ctx.live_weather[dest || 'Uttarakhand'] = weather;

  return ctx;
}

async function sendMessage(overrideText) {
  const text = (overrideText || inputBox.value).trim();
  if (!text || isLoading) return;

  inputBox.value = '';
  inputBox.style.height = 'auto';
  isLoading = true;
  sendBtn.disabled = true;
  suggestionsBar.innerHTML = '';

  addMessage('user', text);
  conversationHistory.push({ role: 'user', content: text });

  showTyping();

  try {
    const ctx = await buildTravelContext();
    currentContext = ctx;

    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: conversationHistory,
        context: currentContext,
      }),
    });

    removeTyping();

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = data.reply || 'I could not generate a response. Please try again.';

    addMessage('bot', reply);
    conversationHistory.push({ role: 'assistant', content: reply });

    suggestNext(text, reply);

  } catch (err) {
    removeTyping();

    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      addMessage('bot', getOfflineResponse(text));
    } else {
      addMessage('bot', `I'm having trouble connecting right now — ${err.message}. Please check your API key is set in Vercel environment variables.`);
    }
    conversationHistory.push({ role: 'assistant', content: '(Error occurred)' });
  }

  isLoading = false;
  sendBtn.disabled = false;
  inputBox.focus();
}

function getOfflineResponse(text) {
  const lower = text.toLowerCase();

  if (lower.includes('char dham') || lower.includes('chardham')) {
    return `**Char Dham Yatra — Quick Overview**

The Char Dham circuit covers four sacred sites: Yamunotri → Gangotri → Kedarnath → Badrinath.

**Best season:** May–June and September–October
**Duration:** 10–14 days for the full circuit
**Registration:** Mandatory biometric registration at uttarakhandtourism.gov.in

**Rough cost estimate (per person):**
- Budget: ₹15,000–20,000
- Mid-range: ₹25,000–35,000
- Includes transport, GMVN stays, and meals

*Note: I'm currently in offline mode. Connect to the API for a personalised day-by-day itinerary.*`;
  }

  if (lower.includes('rishikesh')) {
    return `**Rishikesh — Quick Overview**

The yoga and adventure capital of the world sits at 356m on the Ganges.

**Highlights:** Laxman Jhula · Ram Jhula · Triveni Ghat Aarti · White water rafting · Bungee jumping · Beatles Ashram
**Best season:** September–November, February–May

**Rough costs:**
- Budget stay: ₹700–1,200/night
- Mid-range: ₹2,000–4,000/night
- Rafting (16km): ₹600 per person
- Bungee jump: ₹3,550

*I'm in offline mode. Add your API key to get a personalised itinerary.*`;
  }

  return `I'm currently unable to connect to the AI service. Please ensure your **GROQ_API_KEY** is set in your Vercel environment variables.

In the meantime, you can explore Uttarakhand destinations at:
- uttarakhandtourism.gov.in (official tourism portal)
- gmvnl.com (GMVN guesthouses booking)`;
}

function suggestNext(userMsg, botReply) {
  const lower = (userMsg + ' ' + botReply).toLowerCase();
  let chips = [];

  if (lower.includes('char dham') || lower.includes('kedarnath') || lower.includes('badrinath')) {
    chips = ['How do I register for Char Dham?', 'Best route for Char Dham', 'Budget for Char Dham Yatra', 'Helicopter to Kedarnath'];
  } else if (lower.includes('rishikesh') || lower.includes('rafting') || lower.includes('yoga')) {
    chips = ['Best ashrams in Rishikesh', 'Rafting packages & cost', 'Yoga retreat recommendations', 'Haridwar to Rishikesh travel'];
  } else if (lower.includes('nainital') || lower.includes('corbett') || lower.includes('kumaon')) {
    chips = ['Jim Corbett safari booking', 'Nainital lake boating cost', 'Bhimtal vs Nainital', 'Corbett zone comparison'];
  } else if (lower.includes('auli') || lower.includes('ski')) {
    chips = ['Auli ski course fees', 'Auli ropeway timings', 'Best time for Auli snow', 'Joshimath to Auli'];
  } else if (lower.includes('valley') || lower.includes('flower')) {
    chips = ['Hemkund Sahib trek', 'Ghangaria accommodation', 'Valley of Flowers season', 'Badrinath after Valley of Flowers'];
  } else if (lower.includes('itinerary') || lower.includes('plan') || lower.includes('days')) {
    chips = ['Add pricing breakdown', 'Transport options', 'Budget accommodation options', 'Extend by 2 more days'];
  } else {
    chips = ['Plan a 5-day trip to Nainital', 'Char Dham Yatra guide', 'Best places in Oct–Nov', 'Adventure trips in Rishikesh'];
  }

  updateSuggestions(chips);
}

function loadPopularPackage(pkg) {
  const queries = {
    char_dham: 'Plan a complete Char Dham Yatra for 2 people from Delhi in September. Give me a day-by-day itinerary with costs.',
    nainital: 'Plan a 4-day trip to Nainital and Jim Corbett from Delhi for 2 people. Budget is mid-range. Include accommodation and safari costs.',
    rishikesh: 'Plan a 3-day adventure trip to Rishikesh from Delhi. Include rafting, yoga, and top sights. Budget is around ₹5,000 per person.',
    auli: 'Plan a 4-day ski trip to Auli from Dehradun in January for 2 people. Include ropeway, skiing, and hotel costs.',
    valley: 'Plan a Valley of Flowers trek from Haridwar for 6 days in August. Include Hemkund Sahib. What are the costs and logistics?',
    mussoorie: 'Plan a 3-day trip to Mussoorie from Delhi for a couple. Include must-see places and a cost breakdown.',
  };

  const msg = queries[pkg] || `Tell me about ${pkg} in Uttarakhand`;
  inputBox.value = msg;
  sendMessage(msg);
}

function setupPopularItems() {
  document.querySelectorAll('.popular-item').forEach(item => {
    item.addEventListener('click', () => {
      const pkg = item.dataset.pkg;
      loadPopularPackage(pkg);
    });
  });
}

function setupAutoResize() {
  inputBox.addEventListener('input', () => {
    inputBox.style.height = 'auto';
    inputBox.style.height = Math.min(inputBox.scrollHeight, 100) + 'px';
  });

  inputBox.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function setupPlanButton() {
  document.getElementById('plan-btn').addEventListener('click', () => {
    const dest = document.getElementById('dest-input').value.trim();
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const source = document.getElementById('source-city').value.trim();
    const group = document.getElementById('group-size').value;
    const budget = document.getElementById('budget').value;

    if (!dest) {
      alert('Please enter a destination in Uttarakhand');
      return;
    }

    const nights = startDate && endDate
      ? Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000))
      : null;

    const msg = [
      `Plan a ${nights ? nights + '-night' : 'multi-day'} trip to ${dest}`,
      source ? `starting from ${source}` : '',
      startDate ? `from ${new Date(startDate).toDateString()}` : '',
      endDate ? `to ${new Date(endDate).toDateString()}` : '',
      `for ${group || 2} person(s)`,
      budget ? `with a ${budget} budget` : '',
      '. Give me a complete day-by-day itinerary with transport options, accommodation recommendations, entry fees, and a total cost estimate.',
    ].filter(Boolean).join(' ');

    sendMessage(msg);
  });
}

async function loadWeatherWidget() {
  const widget = document.getElementById('weather-widget');
  if (!widget) return;
  const weather = await fetchWeather(30.0869, 78.2676);
  if (weather) {
    widget.innerHTML = `
      <div class="weather-widget-title">Rishikesh right now</div>
      <div class="weather-main">${weather.temp_c}°C</div>
      <div class="weather-desc">${weather.condition}</div>`;
  }
}

function init() {
  sendBtn.addEventListener('click', () => sendMessage());
  setupAutoResize();
  setupPlanButton();
  setupPopularItems();
  loadWeatherWidget();

  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  document.getElementById('start-date').value = today;
  document.getElementById('end-date').value = nextWeek;

  updateSuggestions([
    'Plan Char Dham Yatra',
    'Best places in October',
    'Rishikesh adventure trip',
    'Valley of Flowers trek',
    'Weekend from Delhi',
  ]);

  setTimeout(() => inputBox.focus(), 300);
}

document.addEventListener('DOMContentLoaded', init);
