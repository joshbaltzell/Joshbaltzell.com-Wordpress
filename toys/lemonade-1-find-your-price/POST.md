Draft for Josh to edit.

Title: Lemonade 1: Find your price
Excerpt: A game. You don't know what people will pay for lemonade. Pick a price each day for 30 days, beside a bot that is learning too, and see what finding the price costs.
Toy type: Game
Tags: game

---

You run a lemonade stand for 30 days. Each morning you pick a price between $2.00 and $6.00. A cup costs $1.20 to make.

What you don't see is how likely a visitor is to buy at each price. The only way to learn it is to charge prices and watch. Every day on a price that turns out badly is money lost. Every day on the price you already like is a day you learn nothing new.

A bot plays the same days beside you, with the same visitors. It uses Thompson sampling, first described by William R. Thompson in 1933. It keeps a rough guess for each price, draws a plausible value from each guess every morning, charges the price that looks best, and updates. Prices it is unsure about still get tried now and then. Nobody tells it when to stop exploring.

The chart shows both of you, day by day. The bot usually looks worse for the first week or so. That is the cost of testing. Whether it pays back by day 30 depends on the round.

Many people settle on a price after two or three days. At the end, the toy says what happened in your round: how many prices you tried, when you settled, and how both of you compare with the best single price, chosen in hindsight.

Rounds cycle through four hidden curves. This is the first of four lessons.
