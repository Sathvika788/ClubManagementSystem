import sys
import json
import sacrebleu
from jiwer import wer
import nltk
from nltk.translate.meteor_score import meteor_score
from nltk.tokenize import word_tokenize
from Levenshtein import distance as levenshtein_distance
import pandas as pd

nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('wordnet')

# Receive temperory input file path from Node.js
input_file = sys.argv[1]
gold_sentences = pd.read_csv("gold.csv")['Name'].tolist()
participant_sentences = pd.read_csv(input_file)['Name'].tolist()

# Ensure datasets have the same number of rows
if len(gold_sentences) != len(participant_sentences):
    print(json.dumps({"error": f"Datasets must have the same number of rows gold : {len(gold_sentences)}, part : {len(participant_sentences)}"}))
    sys.exit()

# Calculate BLEU
bleu_score = sacrebleu.corpus_bleu(participant_sentences, [gold_sentences]).score

# Calculate WER
wer_score = wer(gold_sentences, participant_sentences)

# Tokenize for METEOR
gold_tokenized = [word_tokenize(sentence) for sentence in gold_sentences]
participant_tokenized = [word_tokenize(sentence) for sentence in participant_sentences]
meteor_scores = [
    meteor_score([ref], hyp)
    for ref, hyp in zip(gold_tokenized, participant_tokenized)
]
avg_meteor = sum(meteor_scores) / len(meteor_scores)

# Calculate Levenshtein distance
edit_distances = [
    levenshtein_distance(ref, hyp)
    for ref, hyp in zip(gold_sentences, participant_sentences)
]
avg_edit_distance = sum(edit_distances) / len(edit_distances)

# Return results as JSON
results = {
    "bleu_score": bleu_score,
    "wer_score": wer_score,
    "avg_meteor": avg_meteor,
    "avg_edit_distance": avg_edit_distance,
}
print(json.dumps(results))