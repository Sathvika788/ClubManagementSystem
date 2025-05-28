import pandas as pd
import sys
import json
from nltk.translate.chrf_score import sentence_chrf
from sacrebleu import (
    sentence_bleu,
    corpus_bleu,
    corpus_chrf,
    corpus_ter,
)
from jiwer import wer
from nltk.translate.meteor_score import meteor_score
from Levenshtein import distance as levenshtein_distance

#--
# This script reads two CSVs with a "Text" column,
# tokenizes strictly on whitespace, and computes:
#  • sentence-level BLEU & chrF
#  • sentence-level TER (via corpus_ter, no tokenize argument)
#  • corpus-level BLEU, TER & chrF
#  • METEOR, WER, and raw edit-distance
#--

def evaluate_translations(
    gold_path: str,
    hyp_path: str,
    colname: str = "Text",
    sacre_tokenize: str = "none",    # for BLEU & chrF only
):
    # load & normalize (lowercase & strip)
    gold = (
        pd.read_csv(gold_path)[colname]
        .astype(str)
        .str.strip()
        .str.lower()
        .tolist()
    )
    hyp = (
        pd.read_csv(hyp_path)[colname]
        .astype(str)
        .str.strip()
        .str.lower()
        .tolist()
    )
    if len(gold) != len(hyp):
        return {"error": f"Datasets must have the same number of rows. gold: {len(gold)}, selected: {len(hyp)}"}
    # accumulators
    bleu_s, ter_s, chrf_s = [], [], []
    meteor_s, wer_s, edit_s = [], [], []

    for ref, hyp in zip(gold, hyp):
        # BLEU (accepts tokenize)
        bleu = sentence_bleu(hyp, [ref], tokenize=sacre_tokenize).score
        # chrF (no tokenize argument)
        chrf = sentence_chrf(hyp, [ref])
        # TER via corpus_ter (no tokenize arg)
        ter = corpus_ter([hyp], [[ref]]).score

        bleu_s.append(bleu)
        chrf_s.append(chrf)
        ter_s.append(ter)

        # METEOR expects token lists
        meteor_s.append(meteor_score([ref.split()], hyp.split()))

        # WER: jiwer defaults to splitting on spaces
        wer_s.append(wer([ref], [hyp]))

        # raw character-level edit distance
        edit_s.append(levenshtein_distance(ref, hyp))

    # corpus-level
    corp_bleu = corpus_bleu(hyp, [gold], tokenize=sacre_tokenize).score
    corp_chrf = corpus_chrf(hyp, [gold]).score
    corp_ter = corpus_ter(hyp, [gold]).score

    # print
    def avg(xs): return sum(xs) / len(xs)

    return {
        "avg_bleu_score":    f"{avg(bleu_s):.2f}",
        "avg_ter_score":     f"{avg(ter_s):.2f}",
        "avg_chrf_score":    f"{avg(chrf_s):.2f}",
        "avg_meteor_score":  f"{avg(meteor_s):.2f}",
        "avg_wer_score":     f"{avg(wer_s):.2f}",
        "avg_edit_distance": f"{avg(edit_s):.1f}",
        "corpus_bleu_score": f"{corp_bleu:.2f}",
        "corpus_ter_score":  f"{corp_ter:.2f}",
        "corpus_chrf_score": f"{corp_chrf:.2f}",
    }


if __name__ == "__main__":
    input_file = sys.argv[1]
    language = sys.argv[2]
    if language == "English" :
        gold = "gold.csv"
    elif language == "Mizo" :
        gold = "goldMizo.csv"
    else :
        gold = "goldMizo.csv"
    result = evaluate_translations(gold, input_file, colname="Text", sacre_tokenize="none")
    print(json.dumps(result))
    if "error" in result.keys() :
        sys.exit()
