(() => {
  "use strict";

  const projectUrl = "https://yticogmmbpbqljfbtjag.supabase.co";
  const publishableKey = "sb_publishable_YK--EsauidA8dnCoSLdJCQ_NAXytnyn";
  const functionUrl = `${projectUrl}/functions/v1/arcade-scores`;

  class ArcadeLeaderboard {
    constructor(gameId, list, status) {
      this.gameId = gameId;
      this.list = list;
      this.status = status;
      this.scores = [];
      this.refresh();
    }

    async request(path, body) {
      const response = await fetch(`${functionUrl}/${path}`, {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Leaderboard request failed (${response.status}).`);
      return result;
    }

    async refresh() {
      this.status.textContent = "Loading global scores…";
      try {
        const query = new URLSearchParams({
          select: "player_name,score,created_at",
          game_id: `eq.${this.gameId}`,
          order: "score.desc,created_at.desc",
          limit: "5"
        });
        const response = await fetch(`${projectUrl}/rest/v1/game_scores?${query}`, {
          headers: { apikey: publishableKey }
        });
        if (!response.ok) throw new Error(`Could not load scores (${response.status}).`);
        this.scores = await response.json();
        this.render();
        return true;
      } catch (error) {
        console.error("Could not load the global leaderboard.", error);
        this.list.replaceChildren();
        this.status.textContent = "Global scores could not be loaded. Check your connection and refresh.";
        return false;
      }
    }

    render() {
      this.list.replaceChildren();
      this.scores.forEach((entry, index) => {
        const item = document.createElement("li");
        const rank = document.createElement("span");
        rank.className = "score-rank";
        rank.textContent = `${index + 1}.`;
        const name = document.createElement("span");
        name.className = "score-name";
        name.textContent = entry.player_name;
        const score = document.createElement("strong");
        score.className = "score-value";
        score.textContent = Number(entry.score).toLocaleString();
        item.append(rank, name, score);
        this.list.append(item);
      });
      this.status.textContent = this.scores.length
        ? "Top 5 verified global scores"
        : "No scores yet. Be the first!";
      if (this.scores.length < 5) {
        const empty = document.createDocumentFragment();
        for (let index = this.scores.length; index < 5; index++) {
          const item = document.createElement("li");
          item.className = "score-empty";
          item.textContent = `${index + 1}. —`;
          empty.append(item);
        }
        this.list.append(empty);
      }
    }

    qualifies(score) {
      if (score <= 0) return false;
      return this.scores.length < 5 || score >= Number(this.scores[4].score);
    }

    async startRun() {
      return this.request("start", { gameId: this.gameId });
    }

    async finishRun({ sessionId, score, ticks, events }) {
      if (!sessionId || !(await this.refresh()) || !this.qualifies(score)) return false;
      let name;
      while (true) {
        name = window.prompt("You made the global top 5! Enter a name with exactly 5 letters:");
        if (name === null) return false;
        name = name.trim().toUpperCase();
        if (/^[A-Z]{5}$/.test(name)) break;
        window.alert("Your name must be exactly 5 letters (A–Z).");
      }

      this.status.textContent = "Verifying your score…";
      try {
        const result = await this.request("submit", {
          gameId: this.gameId,
          sessionId,
          playerName: name,
          score,
          ticks,
          events
        });
        if (!result.accepted) {
          this.status.textContent = result.message || "Your score did not make the global top 5.";
          return false;
        }
        this.status.textContent = "Verified! Your score is on the global leaderboard.";
        await this.refresh();
        return true;
      } catch (error) {
        console.error("Could not submit the verified score.", error);
        this.status.textContent = error.message || "Could not submit your score. Please try again.";
        return false;
      }
    }
  }

  window.ArcadeLeaderboard = {
    create(gameId) {
      return new ArcadeLeaderboard(
        gameId,
        document.querySelector("#high-score-list"),
        document.querySelector("#high-score-status")
      );
    }
  };
})();
