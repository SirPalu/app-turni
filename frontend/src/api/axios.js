// Configurazione Axios per chiamate API
import axios from 'axios';

// URL base del backend
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Crea istanza axios configurata
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000, // 10 secondi
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: aggiunge automaticamente il token JWT a ogni richiesta
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor: gestisce errori globali (es. token scaduto)
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token scaduto o non valido
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ===== FUNZIONI API =====

// AUTH
export const login = (username, password) => {
  return axiosInstance.post('/auth/login', { username, password });
};

export const getMe = () => {
  return axiosInstance.get('/auth/me');
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  return axiosInstance.post('/auth/logout');
};

// USERS
export const getAllUsers = () => {
  return axiosInstance.get('/users');
};

export const getUserById = (id) => {
  return axiosInstance.get(`/users/${id}`);
};

export const createUser = (userData) => {
  return axiosInstance.post('/users', userData);
};

export const updateUser = (id, userData) => {
  return axiosInstance.put(`/users/${id}`, userData);
};

export const deleteUser = (id) => {
  return axiosInstance.delete(`/users/${id}`);
};

// TURNI
export const getTurniSettimana = (data) => {
  return axiosInstance.get(`/turni/settimana/${data}`);
};

export const getTurniUtente = (userId, settimana) => {
  return axiosInstance.get(`/turni/user/${userId}/settimana/${settimana}`);
};

export const createOrUpdateTurno = (turnoData) => {
  return axiosInstance.post('/turni', turnoData);
};

export const deleteTurno = (id) => {
  return axiosInstance.delete(`/turni/${id}`);
};

// PREFERENZE
export const getPreferenze = (userId, settimana) => {
  return axiosInstance.get(`/turni/preferenze/${userId}/settimana/${settimana}`);
};

export const savePreferenze = (preferenzeData) => {
  return axiosInstance.post('/turni/preferenze', preferenzeData);
};

// ✅ ORE NL (NON LAVORATO)
export const assegnaOreNL = (nlData) => {
  return axiosInstance.post('/nl/assegna', nlData);
};

export const getOreNL = (userId, settimana) => {
  return axiosInstance.get(`/nl/${userId}/${settimana}`);
};

export const getOreNLSettimana = (settimana) => {
  return axiosInstance.get(`/nl/settimana/${settimana}`);
};

export const eliminaOreNL = (userId, settimana) => {
  return axiosInstance.delete(`/nl/${userId}/${settimana}`);
};

// FERIE
export const creaRichiestaFerie = (ferieData) => {
  return axiosInstance.post('/ferie/richiesta', ferieData);
};

export const getRichiesteDipendente = (userId, stato) => {
  const params = stato ? `?stato=${stato}` : '';
  return axiosInstance.get(`/ferie/mie/${userId}${params}`);
};

export const eliminaRichiesta = (richiestaId) => {
  return axiosInstance.delete(`/ferie/richiesta/${richiestaId}`);
};

export const getTutteRichiesteFerie = (filtri) => {
  const params = new URLSearchParams(filtri).toString();
  return axiosInstance.get(`/ferie/tutte${params ? '?' + params : ''}`);
};

export const gestisciRichiestaFerie = (richiestaId, azione, note) => {
  return axiosInstance.put(`/ferie/gestisci/${richiestaId}`, { azione, note_admin: note });
};

export default axiosInstance;

// VALIDAZIONI
export const getValidazioniSettimana = (data) => {
  return axiosInstance.get(`/validazioni/settimana/${data}`);
};

// ALGORITMO
export const generaPianificazioneAutomatica = (settimana, config) => {
  return axiosInstance.post('/algoritmo/genera', { settimana, config });
};
// IMPORTA PREFERENZE
export const importaPreferenze = (settimana) => {
  return axiosInstance.post('/turni/importa-preferenze', { settimana });
};

// RESET SETTIMANA
export const resetSettimana = (settimana) => {
  return axiosInstance.delete(`/turni/reset-settimana/${settimana}`);
};

// PRESIDIO CONFIG
export const getConfigPresidio = (settimana) => {
  return axiosInstance.get(`/presidio/config/${settimana}`);
};

export const updatePresidioGiorno = (settimana, giorno, tipo) => {
  return axiosInstance.put(`/presidio/config/${settimana}/giorno/${giorno}`, { tipo });
};
// STORICO
export const getStoricoRiassuntivo = () => {
  return axiosInstance.get('/storico/riassuntivo');
};

export const getStoricoDettaglioDipendente = (userId) => {
  return axiosInstance.get(`/storico/dipendente/${userId}`);
};