// ⚠️ TON URL DE WORKER CLOUDFLARE ⚠️
const WORKER_URL = "https://asentum-proxy.yggcomptemhd.workers.dev/";

const POOL_ASE = 60000000;
const PAGE_SIZE = 50;
let currentOffset = 0;

// Chargement automatique du Total XP réseau au démarrage de la page
async function fetchNetworkTotalXp() {
    const displayEl = document.getElementById('total-xp-display');
    const hiddenInput = document.getElementById('total-xp-input');
    const syncTimeEl = document.getElementById('xp-sync-time');

    if (!displayEl) return;

    try {
        const res = await fetch(`${WORKER_URL}/api/total-xp`);
        if (!res.ok) throw new Error("Erreur réseau");
        const data = await res.json();

        if (data.totalXp) {
            hiddenInput.value = data.totalXp;
            displayEl.value = data.totalXp.toLocaleString('fr-FR') + " XP";
            
            if (data.updatedAt) {
                const date = new Date(data.updatedAt);
                syncTimeEl.innerText = `Synchronisé à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
            }
            updateCalculations();
        }
    } catch (e) {
        displayEl.value = "480 000 000 XP";
        syncTimeEl.innerText = "Mode secours (valeur estimée)";
        updateCalculations();
    }
}

// Lancer la récupération dès que le DOM est prêt
document.addEventListener("DOMContentLoaded", fetchNetworkTotalXp);

async function startSearch(startOffset = 0) {
    const query = document.getElementById('wallet-input').value.trim().toLowerCase();
    const statusEl = document.getElementById('search-status');
    const btn = document.getElementById('search-btn');
    const continueBtn = document.getElementById('continue-btn');

    if (!query) {
        statusEl.innerText = "⚠️ Entre une adresse ou un pseudo.";
        statusEl.style.color = "#fbbf24";
        return;
    }

    btn.disabled = true;
    btn.innerText = "Scan...";
    continueBtn.classList.add('hidden');
    statusEl.style.color = "#60a5fa";

    try {
        let foundUser = null;
        let totalWallets = 191799;
        const pagesToScan = 10; // 500 rangs par session

        for (let i = 0; i < pagesToScan; i++) {
            const offset = startOffset + (i * PAGE_SIZE);
            currentOffset = offset + PAGE_SIZE;
            statusEl.innerText = `⏳ Scan rangs ${offset + 1} à ${offset + PAGE_SIZE}...`;

            const res = await fetch(`${WORKER_URL}/api/leaderboard?limit=${PAGE_SIZE}&offset=${offset}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const data = await res.json();
            if (data.total) totalWallets = data.total;
            if (!data.items || data.items.length === 0) break;

            foundUser = data.items.find(item => {
                const addr0x = item.primaryAddress ? item.primaryAddress.toLowerCase() : "";
                const dispName = item.displayName ? item.displayName.toLowerCase() : "";
                const primName = item.primaryName ? item.primaryName.toLowerCase() : "";
                
                return addr0x.includes(query) || 
                       dispName === query || 
                       primName === query ||
                       primName.includes(query);
            });

            if (foundUser) break;
        }

        if (foundUser) {
            document.getElementById('user-name').innerText = foundUser.displayName || foundUser.primaryName || "Farmer";
            document.getElementById('user-address').innerText = foundUser.primaryAddress || foundUser.primaryName || "Adresse non liée";
            document.getElementById('user-rank').innerText = `Rank #${foundUser.rank}`;
            document.getElementById('total-wallets').innerText = `sur ${totalWallets.toLocaleString('fr-FR')} wallets`;
            document.getElementById('user-xp-input').value = foundUser.totalXp;

            document.getElementById('results-card').classList.remove('hidden');
            updateCalculations();

            statusEl.innerText = `✅ Compte trouvé au Rank #${foundUser.rank} !`;
            statusEl.style.color = "#34d399";
        } else {
            statusEl.innerText = `⚠️ Non trouvé dans les rangs ${startOffset + 1} à ${currentOffset}.`;
            statusEl.style.color = "#fbbf24";
            continueBtn.classList.remove('hidden');
        }
    } catch (e) {
        statusEl.innerText = "❌ Erreur de connexion au Worker Cloudflare.";
        statusEl.style.color = "#f87171";
    } finally {
        btn.disabled = false;
        btn.innerText = "Chercher";
    }
}

function continueSearch() { 
    startSearch(currentOffset); 
}

function enableManualMode() {
    document.getElementById('user-name').innerText = "Calcul Manuel";
    document.getElementById('user-address').innerText = document.getElementById('wallet-input').value || "Personnalisé";
    document.getElementById('user-rank').innerText = "Rank #--";
    document.getElementById('results-card').classList.remove('hidden');
    updateCalculations();
}

function updateCalculations() {
    const userXp = parseFloat(document.getElementById('user-xp-input').value) || 0;
    const totalXp = parseFloat(document.getElementById('total-xp-input').value) || 1;

    const ratio = userXp / totalXp;
    document.getElementById('user-ratio').innerText = (ratio * 100).toFixed(4) + '%';

    const allocatedAse = ratio * POOL_ASE;
    document.getElementById('allocated-ase').innerText = allocatedAse.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' ASE';

    const priceUni = parseFloat(document.getElementById('price-uni').value) || 0;
    const priceMexc = parseFloat(document.getElementById('price-mexc').value) || 0;
    const avgPrice = (priceUni + priceMexc) / 2;

    const totalUsdt = allocatedAse * avgPrice;
    document.getElementById('allocated-usdt').innerText = '~' + totalUsdt.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' USDT';
}
