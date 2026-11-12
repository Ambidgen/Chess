/* Opening repertoire + lesson content for chess-trainer.html.
 * Kept as a plain module so it can be validated by web/tests/core.test.mjs.
 */
export const OPENINGS = [
  {
    id: 'sicilian-najdorf', name: 'Sicilian Defence — Najdorf', eco: 'B90', side: 'b',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6', 'Be3', 'e5', 'Nb3', 'Be6', 'f3', 'Be7', 'Qd2', 'O-O', 'O-O-O'],
    ideas: [
      'Black attacks on the c-file with ...a6 and ...d5, giving the half-open c-file to the rook on c8.',
      '...e5 and ...Be6 aim at the d4-knight; Nb3 re-groups it so Black can play ...d5 with ...Nxe4.',
      'The long castle makes a safe king but keeps the c-file open — White must watch the ...Nxe4 ideas.'
    ]
  },
  {
    id: 'sicilian-dragon', name: 'Sicilian Defence — Dragon', eco: 'B27', side: 'b',
    moves: ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'f3', 'O-O', 'Qd2', 'Nc6', 'Bc4'],
    ideas: [
      'Black fianchettoes the bishop on g7 to pressure the long diagonal.',
      '...Nbd7 and ...Be6 connect the pieces and prepare ...d5.',
      'White keeps a broad centre with d4 and e4 and avoids the ...d5 break until it is prepared.'
    ]
  },
  {
    id: 'sicilian-sveshnikov', name: 'Sicilian Defence — Sveshnikov', eco: 'B33', side: 'b',
    moves: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5', 'Ndb5', 'd6', 'Bc4', 'Be7'],
    ideas: [
      'Black concedes the centre with ...e5 to open the c-file and the d5 outpost.',
      '...d6 and ...Bb7 create the typical Sveshnikov bishop pair.',
      'White uses Ndb5 to keep the c6-knight tied down and prepares f3, Qd2 and O-O-O.'
    ]
  },
  {
    id: 'sicilian-paulsen', name: 'Sicilian Defence — Paulsen', eco: 'B42', side: 'b',
    moves: ['e4', 'c5', 'Nf3', 'e6', 'd4', 'cxd4', 'Nxd4', 'Nc6', 'Nc3', 'Qc7', 'Be3', 'a6', 'Bd3', 'Nf6'],
    ideas: [
      'The Paulsen is a flexible, slow Sicilian that keeps ...d6 and ...b5 in reserve.',
      '...Qc7 supports ...b5 and prepares the central break.',
      'White develops normally and castles before opening the centre.'
    ]
  },
  {
    id: 'sicilian-alapin', name: 'Sicilian Defence — Alapin', eco: 'B22', side: 'b',
    moves: ['e4', 'c5', 'c3', 'Nf6', 'e5', 'Nd5', 'd4'],
    ideas: [
      'Alapin reverses the Sicilian to avoid Black\'s entire opening preparation.',
      'c3 and d4 build a big centre that cramps the c5-pawn.',
      'Black must play ...cxd4 to open lines, which hands White the c-file.'
    ]
  },
  {
    id: 'french-winawer', name: 'French Defence — Winawer', eco: 'C15', side: 'b',
    moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Bb4', 'e5', 'c5', 'a3', 'Bxc3+', 'bxc3', 'Ne7', 'Qg4', 'Qc7', 'Qxg7', 'Rg8', 'Qxh7'],
    ideas: [
      'The Winawer attacks the c3-knight with ...Bb4 and later ...c5 and ...Ne7.',
      'Black\'s dark-squared bishop is often sacrificed on g7 to open the g-file.',
      'White castles long and uses the a-pawn to harass the bishop.'
    ]
  },
  {
    id: 'french-classical', name: 'French Defence — Classical', eco: 'C11', side: 'b',
    moves: ['e4', 'e6', 'd4', 'd5', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e5', 'Nfd7', 'Bxe7', 'Qxe7', 'Nb5', 'Nb6', 'c3'],
    ideas: [
      'Black plays the solid e6/d5 structure and prepares ...c5 or ...c6.',
      'The Winawer (3...Bb4) is the aggressive branch; the Classical keeps flexibility.',
      'Watch for the classic ...b6 and ...Bb7 ideas against an early Nb5.'
    ]
  },
  {
    id: 'caro-kann-classical', name: 'Caro-Kann Defence — Classical', eco: 'B18', side: 'b',
    moves: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Bf5', 'Ng3', 'Bg6', 'h4', 'h6', 'Nf3', 'Nd7'],
    ideas: [
      'The Caro-Kann is rock solid: ...d5 without weakening the king.',
      '...Bf5 and ...Bg6 keep pressure on e4 while Black develops with ...Nd7.',
      'The Advanced Variation (3.e5) is the sharpest branch to learn next.'
    ]
  },
  {
    id: 'caro-kann-advance', name: 'Caro-Kann Defence — Advance', eco: 'B12', side: 'b',
    moves: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5', 'Bd3', 'Bxd3', 'Qxd3', 'e6', 'Nc3', 'Qb6'],
    ideas: [
      '3.e5 locks the centre and cramps Black\'s queenside.',
      'Black trades the light-squared bishop for the bad knight on d3.',
      'The plan is ...c5, ...c4 and a quick ...cxb6 or ...cxd4 break.'
    ]
  },
  {
    id: 'ruy-berlin', name: 'Ruy Lopez — Berlin Defence', eco: 'C67', side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'Nf6', 'O-O', 'Nxe4', 'd4', 'Nd6', 'Bxc6', 'dxc6', 'dxe5', 'Nf5', 'Qxd8+', 'Kxd8'],
    ideas: [
      'The Berlin is the main modern answer to the Ruy Lopez — Black sacrifices a pawn for an active bishop.',
      '...Nxf5 and ...Ng6 attack the e5-pawn and the weak light squares.',
      'White should keep pieces on, play Rd1 and avoid the closed centre.'
    ]
  },
  {
    id: 'ruy-morphy', name: 'Ruy Lopez — Morphy Defence', eco: 'C77', side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3', 'Nb8', 'd4'],
    ideas: [
      '4...a6 drives the bishop and gives Black counterplay on the queenside.',
      'The closed centre (d4, e5, d6) favours Black\'s pieces on the light squares.',
      'White prepares the rook lift to e3 and c4 to attack the b5-pawn.'
    ]
  },
  {
    id: 'ruy-schliemann', name: 'Ruy Lopez — Schliemann Defence', eco: 'C68', side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'f5', 'Nc3', 'Nf6', 'Nxe5', 'd6', 'Nf3', 'Nxe4', 'Bxc6', 'bxc6', 'd3'],
    ideas: [
      '...f5 challenges White\'s centre immediately — the price is the weakened dark squares.',
      'Black grabs the e4-pawn with ...Nxe4 and plays ...d6 for the bishop pair.',
      'White must play carefully and remember the long castling is not always possible.'
    ]
  },
  {
    id: 'qgd-orthodox', name: 'Queen\'s Gambit Declined — Orthodox', eco: 'D37', side: 'w',
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Nf3', 'Be7', 'Bg5', 'O-O', 'e3', 'Nbd7', 'Rc1', 'c6', 'Bd3', 'dxc4'],
    ideas: [
      'The Orthodox keeps the classic structure: pawns on d5 and c6 against White\'s c4 and d4.',
      'Black plans ...Ne4, ...c5 and the minority attack with ...b4 and ...bxc4.',
      'White plays slowly, exchanges on c4 and prepares e4 and Qa4.'
    ]
  },
  {
    id: 'qgd-orthodox-2', name: 'Queen\'s Gambit Declined — Orthodox Defence', eco: 'D43', side: 'w',
    moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3', 'Nbd7', 'Rc1', 'c6', 'Qc2', 'Re8'],
    ideas: [
      'Black adds the classic ...Re8 and ...c6 to prepare ...d5 with a piece on d5.',
      'The Carlsbad structure creates the minority attack on the c-file.',
      'Watch for the exchange variation 8...dxc4 9.Bxc4 Nd5 with a recapture on c6.'
    ]
  },
  {
    id: 'slav', name: 'Slav Defence', eco: 'D10', side: 'w',
    moves: ['d4', 'd5', 'c4', 'c6', 'Nf3', 'Nf6', 'Nc3', 'dxc4', 'a4', 'Bf5', 'Ne5', 'e6', 'f3', 'Bb4', 'e4'],
    ideas: [
      'The Slav supports the centre with ...c6 instead of ...Nf6, so White can play e4 quickly.',
      'Black adopts the Meran (...e6, ...Bb4) to trade off the white queen\'s bishop.',
      'The semi-Slav (...c6 and ...e6 without ...dxc4) is the most popular modern branch.'
    ]
  },
  {
    id: 'catalan', name: 'Catalan Opening', eco: 'E00', side: 'w',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'g3', 'd5', 'Bg2', 'dxc4', 'Nf3', 'Nc6', 'O-O', 'Be7', 'Qc2', 'O-O', 'Qa4', 'Nd7'],
    ideas: [
      'The Catalan combines the Queen\'s Gambit with a g3 fianchetto for a long-term bishop battery.',
      'Black usually takes on c4 and plays the Catalan structure with a c5 break.',
      'White combines Qc2, dxc4 and the g2-bishop to attack the c6 and e6 squares.'
    ]
  },
  {
    id: 'nimzo-indian', name: 'Nimzo-Indian Defence', eco: 'E32', side: 'w',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'd5', 'a3', 'Bxc3+', 'bxc3', 'c5', 'Bd3', 'Nc6', 'Ne2'],
    ideas: [
      'Black pins the c3-knight and fights for e4 with ...Bb4 and ...d5.',
      'The Sämisch (4.a3) is the sharpest way to gain a tempo on the bishop.',
      'White keeps a stable structure and plans e4, Nf3, Be3 and O-O.'
    ]
  },
  {
    id: 'nimzo-samisch', name: 'Nimzo-Indian — Sämisch', eco: 'E45', side: 'w',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'c5', 'a3', 'Bxc3+', 'bxc3', 'cxd4', 'cxd4'],
    ideas: [
      '4.a3 forces the bishop to move, after which White grabs the centre with d4 and c4.',
      'Black restores material with ...cxd4 and gets the half-open c-file for the rook.',
      'The main plan is Nf3, Bd3, O-O and the pressure on e4 and c5.'
    ]
  },
  {
    id: 'kings-indian', name: 'King\'s Indian Defence', eco: 'E90', side: 'w',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'Nf3', 'O-O', 'Be2', 'e5', 'O-O', 'Nc6', 'd5', 'Ne7', 'Nd2'],
    ideas: [
      'Black castles into a kingside attack while White grabs the centre with d4 and e4.',
      'The classic break is ...d5 to open the diagonal and ...f5, ...f4 with a pawn storm.',
      'White keeps pieces on the queenside and plays Nc2, Qd2 and Rb1 for a counterattack.'
    ]
  },
  {
    id: 'kings-indian-samisch', name: 'King\'s Indian — Sämisch', eco: 'E81', side: 'w',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'Bg7', 'e4', 'd6', 'f3', 'O-O', 'Be3', 'Nc6', 'Nge2', 'Rb8', 'Qd2', 'a6'],
    ideas: [
      '3.Nc3 d6 4.f3 is the sharpest test: White wants to crush the centre with e4 and f4.',
      'Black ignores the tension with ...Nc6, ...Rb8 and plays ...b5, ...b4 and ...Bb7.',
      'White must be careful: ...b4 and ...Bb7 can become a dangerous attack on the king.'
    ]
  },
  {
    id: 'grunfeld', name: 'Grünfeld Defence', eco: 'D85', side: 'w',
    moves: ['d4', 'Nf6', 'c4', 'g6', 'Nc3', 'd5', 'cxd5', 'Nxd5', 'e4', 'Nxc3', 'bxc3', 'Bg7', 'Nf3', 'c5', 'Be3', 'Qa5', 'Qd2'],
    ideas: [
      'Black gives up the centre to build a kingside attack with ...g6 and ...Bg7.',
      'The thematic break is ...c5 to undermine White\'s d4-pawn.',
      'White keeps a pawn majority in the centre and plays Qa4, Qd2 and Be3 to harass the bishop.'
    ]
  },
  {
    id: 'english-four-knights', name: 'English Opening — Four Knights', eco: 'A30', side: 'w',
    moves: ['c4', 'e5', 'Nc3', 'Nf6', 'Nf3', 'Nc6', 'g3', 'Bc5', 'Bg2', 'd6', 'O-O', 'O-O', 'd3', 'a6'],
    ideas: [
      'White transposes into a reversed Sicilian with a g3 fianchetto.',
      'Black can play ...e4 to open the centre or ...Re1 with the ...d5 break.',
      'The system is flexible: White can steer into a King\'s Indian Attack or a set-up with e4 and d4.'
    ]
  },
  {
    id: 'english-reversed-sicilian', name: 'English Opening — Reversed Sicilian', eco: 'A30', side: 'w',
    moves: ['c4', 'e5', 'Nc3', 'Nc6', 'g3', 'g6', 'Bg2', 'Bg7', 'd3', 'd6', 'Nf3', 'Nf6', 'O-O', 'O-O', 'Rb1'],
    ideas: [
      'White builds with g3 and Bg2, mirroring the Sicilian but with an extra tempo.',
      'The plan is usually a later d4 and e4 with a kingside pawn storm.',
      'Black plays ...e5 and ...Nge7 to keep flexibility and prepare ...f5.'
    ]
  },
  {
    id: 'italian-giuoco', name: 'Italian Game — Giuoco Piano', eco: 'C54', side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+', 'Bd2', 'Bxd2+', 'Nbxd2', 'd5', 'exd5', 'Nxd5'],
    ideas: [
      'The Giuoco Piano is the quiet relative of the Evans Gambit.',
      'Black grabs the centre with ...d5 and trades into an equal game.',
      'White develops naturally with Nc3, O-O and d3, keeping the bishop pair for now.'
    ]
  },
  {
    id: 'italian-evans', name: 'Italian Game — Evans Gambit', eco: 'C52', side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4', 'Bxb4', 'c3', 'Ba5', 'd4', 'exd4', 'O-O', 'd3', 'Qb3', 'Qf6', 'e5'],
    ideas: [
      '4.b4 offers a piece to open the a1-h8 diagonal and the b-file.',
      'White gets a big centre with d4 and e5 and often an attack on the f7-pawn.',
      'Black must find a pawn move or the kingside becomes very exposed.'
    ]
  },
  {
    id: 'scotch', name: 'Scotch Game', eco: 'C44', side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'd4', 'exd4', 'Nxd4', 'Nf6', 'Nxc6', 'bxc6', 'e5', 'Ne4', 'Qe2', 'Qe7', 'Nc3', 'Nc5', 'Bf4'],
    ideas: [
      'The Scotch opens lines quickly — tactics come fast, so calculate carefully.',
      'The Mieses Variation (4...Be7) keeps things calmer than the gambit 4...Nf6.',
      'White develops with c3, Bd3, Qd2 and O-O for a central pawn duo.'
    ]
  },
  {
    id: 'petrov', name: 'Petrov Defence (Russian)', eco: 'C42', side: 'w',
    moves: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5', 'd6', 'Nf3', 'Nxe4', 'Nc3', 'Nc6', 'Nd4', 'd5', 'Bd3'],
    ideas: [
      'The Petrov is the sound counter to the Ruy Lopez: Black attacks the e4-pawn but keeps the structure.',
      'The Steinitz Variation (3...d6) is the most accurate; the classical 3...d6 4.d4 is solid.',
      'Black plays ...Be7, ...O-O and ...Re8 and accepts an isolated d4-pawn for the bishop pair.'
    ]
  },
  {
    id: 'pirc', name: 'Pirc Defence', eco: 'B07', side: 'w',
    moves: ['e4', 'd6', 'd4', 'Nf6', 'Nc3', 'g6', 'Be3', 'Bg7', 'Qd2', 'O-O', 'Nf3', 'c6', 'O-O-O'],
    ideas: [
      'Black lets White build a big centre and prepares to undermine it with ...c5 or ...e5.',
      'The Austrian Attack (3.f4) is the sharpest way to punish the setup.',
      'Black\'s plan is ...c5 to challenge d4 and then ...cxd4 to open the c-file.'
    ]
  },
  {
    id: 'alekhine', name: 'Alekhine Defence', eco: 'B02', side: 'w',
    moves: ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6', 'Nf3', 'g6', 'Bc4'],
    ideas: [
      'Black provokes a pawn advance and fights for the centre with ...d6 and ...c6.',
      'The safest continuation is 3.d4 with the chance to castle and play c4.',
      'Black develops with ...g6, ...Bg7, ...O-O and ...Nc6 for pressure on e5.'
    ]
  },
  {
    id: 'kings-gambit', name: 'King\'s Gambit', eco: 'C30', side: 'w',
    moves: ['e4', 'e5', 'f4', 'exf4', 'Nf3', 'g5', 'h4', 'g4', 'Ne5'],
    ideas: [
      'The King\'s Gambit offers a pawn for rapid development and the initiative.',
      'The Fischer Defence (3...d6) is the soundest modern answer.',
      'White pushes h4 and g4 to open lines quickly and must castle to stay safe.'
    ]
  },
  {
    id: 'scandinavian', name: 'Scandinavian Defence', eco: 'B01', side: 'w',
    moves: ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5', 'd4', 'Nf6', 'Nf3', 'c6', 'Bc4', 'Bf5'],
    ideas: [
      'The Scandinavian forces White to move the queen again with Qa5.',
      'Modern practice avoids the early queen sortie: 2...Nf6 3.Nf3 dxc4 is the main line.',
      'White gains a tempo and can develop with Bc4 and O-O.'
    ]
  },
  {
    id: 'vienna', name: 'Vienna Game', eco: 'C25', side: 'w',
    moves: ['e4', 'e5', 'Nc3', 'Nc6', 'Bc4', 'Nf6', 'd4', 'exd4', 'e5', 'Ne4', 'Qe2', 'Qe7', 'Nf3', 'Nc5', 'Bf4'],
    ideas: [
      'The Vienna is a quiet relative of the King\'s Gambit and the Ruy Lopez.',
      'Black usually transposes with ...Nf6 and ...d5 or plays the Frankenstein Gambit with ...g5.',
      'White develops actively with Nf3, O-O and d4 for a big centre.'
    ]
  },
  {
    id: 'benoni-modern', name: 'Benoni Defence — Modern', eco: 'A56', side: 'w',
    moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'e6', 'Nc3', 'exd5', 'cxd5', 'd6', 'e4', 'g6', 'f4', 'Bg7', 'Nf3'],
    ideas: [
      'The Modern Benoni gives up the centre to play ...g6, ...Bg7 and a ...c4 or ...b5 break.',
      'White gets a huge centre and should trade on d5 before opening the c-file.',
      'Watch for ...c4 to undermine the d5-pawn and the ...b5 space-gaining break.'
    ]
  },
  {
    id: 'dutch', name: 'Dutch Defence', eco: 'A80', side: 'w',
    moves: ['d4', 'f5', 'g3', 'e6', 'Bg2', 'Nf6', 'Nf3', 'Bb4+', 'Bd2', 'Be7', 'O-O', 'O-O', 'c4'],
    ideas: [
      'The Dutch plays ...f5 for the kingside attack at the price of the king\'s safety.',
      'White is not the fianchetto, which is the "Stonewall" cousin and the safest way to meet it.',
      'Black combines ...e4 with ...d5, but must watch the ...Bb4+ and ...Ne4 ideas.'
    ]
  },
  {
    id: 'london', name: 'London System', eco: 'D02', side: 'w',
    moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'Bd6', 'Nc3', 'c5', 'dxc5', 'Bxc5', 'Bd3', 'O-O', 'O-O', 'Nc6'],
    ideas: [
      'A simple system: Bf4, e3, Nf3, d4 with a later c4 and e4 break.',
      'Black plays the London counter-system with ...c5 and ...Nf6.',
      'Weaknesses: the d4-pawn can be attacked by ...c5 and the c4-pawn by ...e5 or ...c6.'
    ]
  },
  {
    id: 'benko', name: 'Benko Gambit', eco: 'A57', side: 'w',
    moves: ['d4', 'Nf6', 'c4', 'c5', 'd5', 'b5', 'cxb5', 'a6', 'bxa6', 'Bxa6', 'Nc3', 'd6', 'Nf3', 'g6', 'g3', 'Bg7', 'Bg2'],
    ideas: [
      'Black gives up a pawn for long-term pressure on the c3-knight and the a6-bishop.',
      'White recaptures with a bishop, which is considered the best try.',
      'The modern reply is 6...Bxa6 7.Nc3 d6 with a ...g6, ...Bg7 kingside build.'
    ]
  },
  {
    id: 'trompowsky', name: 'Trompowsky Attack', eco: 'A45', side: 'w',
    moves: ['d4', 'Nf6', 'Bg5', 'e6', 'e4', 'h6', 'Bh4', 'b5', 'Bd3', 'Bb4+', 'c3', 'Bb7'],
    ideas: [
      'The Trompowsky copies the Queen\'s Gambit but keeps the bishop on g5.',
      'Black transposes with ...d6 or plays the active ...b5 and ...Bb4+.',
      'The point is to keep the bishop out of the way for an early e4 and c4.'
    ]
  },
  {
    id: 'polish', name: 'Polish Opening', eco: 'A40', side: 'w',
    moves: ['b4', 'e5', 'Bb2', 'Nf6', 'e3', 'Be7', 'f3', 'd5', 'Na3', 'O-O', 'Nc4', 'c6', 'Ne2'],
    ideas: [
      '1.b4 is a simple weapon to reach the queenside quickly and steer Black\'s light-square bishop.',
      'Black usually plays ...e5 to take space in the centre.',
      'White develops normally with Bb5, e3, Nf3 and O-O.'
    ]
  }
];

export const LESSONS = [
  {
    id: 'rules', title: 'The rules of chess', level: 'Beginner',
    summary: 'How the game is played from the first move to the last.',
    body: [
      '<p>Two players move the <strong>white</strong> pieces first. A move is one piece moving to another square — pieces travel in straight lines (rook, queen) or in an L-shape (knight, king, bishop moves diagonally).</p>',
      '<ul><li>You may not move a piece onto a square attacked by an enemy piece, and you may never leave your own king in check.</li><li>Pawns move one square forward (two from their starting square) and capture diagonally.</li><li>Each side has eight pawns, two rooks, two knights, two bishops, one queen and one king.</li></ul>'
    ]
  },
  {
    id: 'notation', title: 'Reading algebraic notation', level: 'Beginner',
    summary: 'Every move has a short, unambiguous name.',
    body: [
      '<p><strong>N</strong> knight, <strong>B</strong> bishop, <strong>R</strong> rook, <strong>Q</strong> queen, <strong>K</strong> king. The letter is followed by the destination square, e.g. <em>Nf3</em>.</p>',
      '<ul><li><strong>x</strong> marks a capture — <em>Bxf7</em>.</li><li><strong>=</strong> introduces a promotion — <em>e8=Q</em>.</li><li><strong>+</strong> is check, <strong>#</strong> is checkmate.</li><li><strong>O-O</strong> is kingside castling, <strong>O-O-O</strong> is queenside castling.</li><li>When two pieces could reach the same square, the origin file or rank is added — <em>Nbd2</em>, <em>R1e2</em>.</li></ul>'
    ]
  },
  {
    id: 'checkmate', title: 'Check, mate and stalemate', level: 'Beginner',
    summary: 'The three ways a game can end.',
    body: [
      '<p><strong>Check</strong> is an attack on the enemy king; the king must be moved, or the attack blocked or captured.</p>',
      '<p><strong>Checkmate</strong> is check with no legal escape. <strong>Stalemate</strong> is not being in check but having no legal move — the game is drawn immediately.</p>',
      '<p>Watch out for stalemate: a lone king in the corner with the wrong bishop colour is a draw, not a win.</p>'
    ]
  },
  {
    id: 'castling', title: 'Castling and special rules', level: 'Beginner',
    summary: 'Castling, en passant, promotion and draws.',
    body: [
      '<p><strong>Castling</strong> moves the king two squares toward a rook and jumps the rook to the other side of the king. You may castle once, never through check, never out of check, and never if the king or that rook has already moved.</p>',
      '<p><strong>En passant</strong> lets a pawn capture a pawn that just stepped two squares past it — but only on the very next move.</p>',
      '<p><strong>Promotion</strong>: a pawn reaching the last rank becomes any piece you choose — almost always a queen.</p>',
      '<p><strong>Draws</strong>: threefold repetition, the fifty-move rule and insufficient material (king versus king, or king and a single minor piece versus king).</p>'
    ]
  },
  {
    id: 'tactics', title: 'Tactical motifs to know', level: 'Intermediate',
    summary: 'The six patterns that win material.',
    body: [
      '<ul><li><strong>Fork</strong> — one piece attacks two targets; the opponent can only save one.</li><li><strong>Pin</strong> — a piece is stuck in front of a more valuable target (usually the king).</li><li><strong>Skewer</strong> — the reverse: a valuable piece is attacked and something valuable hides behind it.</li><li><strong>Discovered attack</strong> — moving one piece uncovers a line against another.</li><li><strong>Deflection</strong> — lure a defender away from its job.</li><li><strong>Removal of the defender</strong> — trade or drive off the piece that guards the target.</li></ul>',
      '<p>Before every capture, ask: <em>what does this piece defend?</em> The answer is often the move you are looking for.</p>'
    ]
  },
  {
    id: 'endgame', title: 'Basic checkmate patterns', level: 'Intermediate',
    summary: 'How to mate with a queen or a rook.',
    body: [
      '<p><strong>King + Queen vs King</strong>: bring the queen next to the enemy king, then use the king to support the final mate. Box the king on the edge — the board edge is your best ally.</p>',
      '<p><strong>King + Rook vs King</strong>: use the <em>cut-off method</em>. Shrink the rectangle between your rook and the enemy king by moving the rook one rank or file closer each time, always keeping the king boxed.</p>',
      '<p><strong>Two bishops</strong> mate along the diagonals: drive the king to the edge and place bishops on adjacent diagonals.</p>',
      '<p><strong>Two knights</strong> can also mate, but only with the help of the enemy king being cornered — it is hard and easy to miss, so drive for mate only when it is forced.</p>'
    ]
  },
  {
    id: 'openings', title: 'Opening principles', level: 'Beginner',
    summary: 'Five rules that keep your opening healthy.',
    body: [
      '<ul><li><strong>Control the centre</strong> with pawns on d4/e4/d5/e5.</li><li><strong>Develop knights and bishops</strong> before moving the same piece twice.</li><li><strong>Castle early</strong> to make the king safe and activate the rook.</li><li><strong>Bring a rook to the open file</strong> once the centre opens.</li><li><strong>Count pawns</strong> — in the endgame every pawn counts, and passed pawns decide games.</li></ul>'
    ]
  },
  {
    id: 'eval', title: 'Reading the evaluation bar', level: 'Intermediate',
    summary: 'What the engine number actually means.',
    body: [
      '<p>The bar shows the score in <strong>pawns</strong> from the point of view of the side to move. <strong>+0.30</strong> means White is slightly better; <strong>+2.00</strong> is about two pawns.</p>',
      '<p>A score beyond <strong>±9.00</strong> usually means a piece is hanging. When the bar reads <strong>#3</strong> the engine has found a forced mate in three moves.</p>',
      '<p>Use the bar as a guide, not an oracle: a huge score in a sharp position can evaporate in one move.</p>'
    ]
  },
  {
    id: 'training', title: 'How to get stronger', level: 'All levels',
    summary: 'A simple routine that actually works.',
    body: [
      '<ul><li><strong>Solve tactics daily</strong> — 10 to 15 minutes, with slow calculation, not fast guessing.</li><li><strong>Review your games</strong> — find the first mistake, not the last one.</li><li><strong>Study endgames</strong> — basic mates, opposition, pawn endgames.</li><li><strong>Learn one opening per side</strong> and understand the plans, not just the moves.</li><li><strong>Analyse with the engine</strong> in this trainer and compare your score with the engine\'s.</li></ul>'
    ]
  }
];

export const SHORTCUTS = [
  ['←', 'Previous move'],
  ['→', 'Next move'],
  ['Home', 'First move'],
  ['End', 'Last move'],
  ['U', 'Take back a move'],
  ['F', 'Flip the board'],
  ['H', 'Show a hint'],
  ['N', 'New game / next puzzle'],
  ['R', 'Resign (play mode)'],
  ['Space', 'Flip the board'],
  ['Esc', 'Close the dialog']
];
