type Result = {
  competitor: {
    name: string;
  };
  mark: string;
};
type WAEvent = {
  gender: "M" | "W";
  races: {
    results: Result[];
  }[];
};

const markToSecs = (mark: string): number => {
  const [h, m, s] = mark.split(":").map((part) => +part);
  return h * (60 * 60) + m * 60 + s;
};

let trialsResults = null;
let menResults: Result[] = [];
let womenResults: Result[] = [];

async function loadResults(id: string) {
  trialsResults = await (
    await fetch(
      "https://pgcs7vfn3jbtjibqmf7fgj6xym.appsync-api.eu-west-1.amazonaws.com/graphql",
      {
        headers: { "x-api-key": "da2-vdx45fhegvbb3jsy3audmvpk6e" },
        method: "POST",

        body: JSON.stringify({
          operationName: "getCalendarCompetitionResults",
          query: `
query getCalendarCompetitionResults($competitionId: Int, $day: Int, $eventId: Int) {
  getCalendarCompetitionResults(competitionId: $competitionId, day: $day, eventId: $eventId) {
    competition {
      dateRange
      endDate
      name
      rankingCategory
      startDate
      venue
      __typename
    }
    eventTitles {
      rankingCategory
      eventTitle
      events {
        event
        eventId
        gender
        isRelay
        perResultWind
        withWind
        summary {
          competitor {
            teamMembers {
              id
              name
              iaafId
              urlSlug
              __typename
            }
            id
            name
            iaafId
            urlSlug
            birthDate
            __typename
          }
          mark
          nationality
          placeInRace
          placeInRound
          points
          raceNumber
          records
          wind
          __typename
        }
        races {
          date
          day
          race
          raceId
          raceNumber
          results {
            competitor {
              teamMembers {
                id
                name
                iaafId
                urlSlug
                __typename
              }
              id
              name
              iaafId
              urlSlug
              birthDate
              hasProfile
              __typename
            }
            mark
            nationality
            place
            points
            qualified
            records
            wind
            remark
            details {
              event
              eventId
              raceNumber
              mark
              wind
              placeInRound
              placeInRace
              points
              overallPoints
              placeInRoundByPoints
              overallPlaceByPoints
              __typename
            }
            __typename
          }
          startList {
            competitor {
              birthDate
              country
              id
              name
              urlSlug
              __typename
            }
            order
            pb
            sb
            bib
            __typename
          }
          wind
          __typename
        }
        __typename
      }
      __typename
    }
    options {
      days {
        date
        day
        __typename
      }
      events {
        gender
        id
        name
        combined
        __typename
      }
      __typename
    }
    parameters {
      competitionId
      day
      eventId
      __typename
    }
    __typename
  }
}`,
          variables: {
            competitionId: id,
            day: null,
            eventId: null,
          },
        }),
      }
    )
  ).json();
  console.log(trialsResults);
  const events: WAEvent[] =
    trialsResults.data.getCalendarCompetitionResults.eventTitles[0].events;
  menResults = events.find((e) => e.gender === "M").races[0].results;
  womenResults = events.find((e) => e.gender === "W").races[0].results;
  document.querySelector("#waiting").innerHTML = `${menResults.length + womenResults.length} results loaded!`;
  (document.querySelector("#process") as HTMLDivElement).style.display =
    "block";
}

function parseCSV(text: string): void {
  const lines = text.split(/\r\n|\n/);
  const lb = lines
    .map((line) => {
      const cols = line.split(",");
      const menPicks = cols.slice(5, 15).map((p) => p.toLowerCase().trim());
      const womenPicks = cols.slice(15, 25).map((p) => p.toLowerCase().trim());
      const genderPlaceScores: number[] = [];
      for (const { results, picks } of [
        { results: menResults, picks: menPicks },
        { results: womenResults, picks: womenPicks },
      ]) {
        let genderPlaceScore = 0;
        for (let n = 1; n <= picks.length; n++) {
          const oldGpc = genderPlaceScore;
          let scoreDiffs: number[] = [];
          if (n === 1) scoreDiffs = [1, 2, 3, 5, 5, -1, -5];
          else if ([2, 3].includes(n)) scoreDiffs = [1, 2, 3, 3, 3, -1, -3];
          else if ([4, 5].includes(n)) scoreDiffs = [1, 2, 2, 2, 2, -1, -2];
          else scoreDiffs = [1, 1, 1, 1, 1, 0, -1];
          let nthPlace =
            results.findIndex(
              (res) => res.competitor.name.toLowerCase() === picks[n - 1]
            ) + 1;
          if (nthPlace === 0) nthPlace = Infinity;
          if (nthPlace <= 10) genderPlaceScore += scoreDiffs[0];
          if (nthPlace <= 5) genderPlaceScore += scoreDiffs[1];
          if (nthPlace <= 3) genderPlaceScore += scoreDiffs[2];
          if (nthPlace <= 1) genderPlaceScore += scoreDiffs[3];
          if (nthPlace === n) genderPlaceScore += scoreDiffs[4];
          if (nthPlace > 10) genderPlaceScore += scoreDiffs[5];
          if (nthPlace > 25) genderPlaceScore += scoreDiffs[6];
          console.log(cols[4], picks[n-1], genderPlaceScore - oldGpc);
        }
        genderPlaceScores.push(genderPlaceScore);
      }
      const mensWinning = cols[25];
      const mensThird = cols[26];
      const womensWinning = cols[27];
      const womensThird = cols[28];
      const diffs: number[] = [];
      const genderTimeScores: number[] = [];
      for (const { results, winningGuess, thirdGuess } of [
        {
          results: menResults,
          winningGuess: mensWinning,
          thirdGuess: mensThird,
        },
        {
          results: womenResults,
          winningGuess: womensWinning,
          thirdGuess: womensThird,
        },
      ]) {
        let genderTimeScore = 0;
        for (const diffSecs of [
          Math.abs(markToSecs(results[0].mark) - markToSecs(winningGuess)),
          Math.abs(markToSecs(results[2].mark) - markToSecs(thirdGuess)),
        ]) {
          diffs.push(diffSecs);
          if (diffSecs <= 120) genderTimeScore += 1;
          if (diffSecs <= 60) genderTimeScore += 1;
          if (diffSecs <= 30) genderTimeScore += 1;
          if (diffSecs <= 10) genderTimeScore += 1;
          if (diffSecs === 0) genderTimeScore += 1;
        }
        genderTimeScores.push(genderTimeScore);
      }
      const cumulativeWinningDifferential = diffs[0] + diffs[2];
      return {
        genderPlaceScores,
        genderTimeScores,
        menScore: genderPlaceScores[0] + genderTimeScores[0],
        womenScore: genderPlaceScores[1] + genderTimeScores[1],
        score: [...genderPlaceScores, ...genderTimeScores].reduce((acc, x) => acc + x, 0),
        cumulativeWinningDifferential,
        email: cols[1],
        team: cols[4],
      };
    })
    .sort((a, b) => {
      if (b.score === a.score)
        return (
          a.cumulativeWinningDifferential - b.cumulativeWinningDifferential
        );
      return b.score - a.score;
    });
  const lbOl = document.querySelector("#lb");
  lbOl.innerHTML = "";
  let csvOut = Object.keys(lb[0]).join(',') + '\n';
  for (const lbItem of lb) {
    const { genderPlaceScores, genderTimeScores, menScore, womenScore, team, score, cumulativeWinningDifferential } = lbItem;
    const newLi = document.createElement("li");
    newLi.innerHTML = `${team}: ${score} pts (${genderPlaceScores[0]} + ${genderTimeScores[0]} = ${menScore} men's, ${genderPlaceScores[1]} + ${genderTimeScores[1]} = ${womenScore} women's) <small>(${cumulativeWinningDifferential} cumulative winning differential)</small>`;
    lbOl.appendChild(newLi);
    csvOut += Object.values(lbItem).join(',') + '\n';
  }
  document.querySelector('#out').innerHTML = csvOut;
}

function handleFiles(files: FileList | null): void {
  if (window.FileReader && files && files.length > 0) {
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const text = reader.result as string;
      parseCSV(text);
    };
    reader.readAsText(files[0]);
  }
}
function processCSV(): void {
  const fileInput = document.getElementById("csvFileInput") as HTMLInputElement;
  const files = fileInput.files;
  if (files && files.length > 0) {
    handleFiles(files);
  } else {
    alert("please select a csv file");
  }
}
