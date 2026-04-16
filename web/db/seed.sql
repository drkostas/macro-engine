--
-- PostgreSQL database dump
--

-- Dumped from database version 17.9 (Homebrew)
-- Dumped by pg_dump version 17.9 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: ingredients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ingredients (id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, is_raw, raw_to_cooked_ratio, category, usda_fdc_id, created_at, shrink_priority, unit, grams_per_unit, unit_step, is_favorite) FROM stdin;
bread_whole_wheat	Bread (whole wheat)	247	13	41	3.4	6	f	\N	carbs	168013	2026-03-14 21:52:33.742045-04	1	slice	30	0.25	f
popcorn_kernels	Popcorn Kernels (air-popped)	387	13	78	4.5	15	t	3	carbs	\N	2026-03-20 16:46:06.506887-04	2	g	\N	0.25	f
egg_whites_carton	Egg Whites (carton)	52	11	0.7	0.2	0	f	\N	protein	\N	2026-03-20 16:46:06.506887-04	2	g	\N	0.25	f
oats_dry	Oats (dry)	379	13.2	67.7	6.5	10.1	t	2.75	carbs	169745	2026-03-14 21:52:33.742045-04	1	g	\N	0.25	f
cottage_cheese_4pct	Cottage Cheese 4%	98	11.1	3.4	4.3	0	f	\N	dairy	173417	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	f
chipotle_brown_rice	Chipotle Brown Rice	185	3.5	31.7	5.3	1.8	f	\N	restaurant	\N	2026-03-28 09:09:58.106707-04	2	serving	113	0.25	f
gu_vanilla_bean_caff	GU Energy Gel Vanilla Bean (Caffeine)	312.5	0	68.75	0	0	f	\N	supplement	\N	2026-03-21 16:57:58.980161-04	2	gel	32	0.25	f
energy_gel	Energy Gel	286	0	71	0	0	f	\N	supplement	\N	2026-03-14 21:52:33.742045-04	3	gel	32	0.25	f
purely_elizabeth_granola	Purely Elizabeth Granola	480	10	56	24	6	f	\N	carbs	174889	2026-03-14 21:52:33.742045-04	1	g	\N	0.25	f
gatorlyte_powder	Gatorlyte Powder Packet	294	0	76.5	0	0	f	\N	drink	\N	2026-03-21 16:57:58.980161-04	2	pkt	17	0.25	f
white_rice_raw	White Rice (raw)	365	7.1	80	0.7	1.3	t	3	carbs	169756	2026-03-14 21:52:33.742045-04	1	g	\N	0.25	f
ground_flaxseed	Ground Flaxseed	534	18.3	28.9	42.2	27.3	f	\N	grain	\N	2026-03-16 09:27:36.955873-04	1	g	\N	0.25	f
protein_powder_whey	Protein Powder (whey)	375	75	12.5	3.8	0	f	\N	supplement	173179	2026-03-14 21:52:33.742045-04	3	scoop	30	0.25	f
chipotle_white_rice	Chipotle White Rice	185	3.5	35.3	3.5	0.9	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
olive_oil	Olive Oil	884	0	0	100	0	f	\N	fat	171413	2026-03-14 21:52:33.742045-04	2	g	\N	0.25	f
raos_arrabiata	Rao's Arrabiata Sauce	80	1.4	7	5.4	1.4	f	\N	sauce	\N	2026-03-14 21:52:33.742045-04	2	g	\N	0.25	f
peanut_butter	Peanut Butter	588	25.1	20	50	6	f	\N	fat	174265	2026-03-14 21:52:33.742045-04	2	g	\N	0.25	f
avocado	Avocado	160	2	8.5	14.7	6.7	f	\N	fat	171705	2026-03-14 21:52:33.742045-04	2	pcs	150	0.25	f
greek_yogurt_2pct	Greek Yogurt 2%	73	10	3.6	2	0	f	\N	dairy	170903	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	f
milk_2pct	Milk 2%	50	3.4	4.8	2	0	f	\N	dairy	173438	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	f
chipotle_fajita_veggies	Chipotle Fajita Vegetables	35	1.8	8.8	0	1.8	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	57	0.25	f
craft_beer_16oz	Craft Beer (16oz)	42	0	3.5	0	0	f	\N	drink	\N	2026-03-22 15:54:52.438565-04	2	pint	473	0.25	f
sports_drink	Sports Drink	26	0	6.4	0	0	f	\N	supplement	\N	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	f
salmon_raw	Salmon (raw)	208	20.4	0	13.4	0	t	0.84	protein	175167	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	f
ipa_beer_16oz	IPA Beer (16oz)	60	0	4	0	0	f	\N	drink	\N	2026-03-22 20:42:44.001585-04	2	pint	473	0.25	f
broccoli_raw	Broccoli (raw)	34	2.8	7	0.4	2.6	t	0.92	vegetable	170379	2026-03-14 21:52:33.742045-04	99	g	\N	0.25	f
carrots_raw	Carrots (raw)	41	0.9	9.6	0.2	2.8	t	1	vegetable	170393	2026-03-14 21:52:33.742045-04	99	g	\N	0.25	f
cherry_tomatoes	Cherry Tomatoes	18	0.9	3.9	0.2	1.2	t	0.87	vegetable	170457	2026-03-14 21:52:33.742045-04	99	g	\N	0.25	f
cucumber	Cucumber	15	0.7	3.6	0.1	0.5	f	\N	vegetable	168409	2026-03-14 21:52:33.742045-04	99	g	\N	0.25	f
spinach	Spinach	23	2.9	3.6	0.4	2.2	f	\N	vegetable	\N	2026-03-16 09:27:36.955873-04	99	g	\N	0.25	f
honey	Honey	304	0.3	82.4	0	0.2	f	\N	carbs	\N	2026-03-16 15:51:50.059269-04	1	g	\N	0.25	f
chipotle_mild_salsa	Chipotle Fresh Tomato Salsa (Mild)	26	0	7	0	0	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	57	0.25	f
frozen_mixed_berries	Frozen Mixed Berries	49	1.1	12.6	0.3	3.7	f	\N	fruit	\N	2026-03-16 09:27:36.955873-04	1	g	\N	0.25	f
greek_yogurt_0pct	Greek Yogurt 0%	54	10	3.4	0.2	0	f	\N	dairy	\N	2026-03-20 16:46:06.506887-04	2	g	\N	0.25	f
yellow_mustard	Yellow Mustard	66	4.4	5.3	3.3	3.3	f	\N	sauce	\N	2026-03-20 22:57:40.58265-04	2	g	\N	0.25	f
powerade_zero_berry	Powerade Zero Mixed Berry	0	0	0	0	0	f	\N	drink	\N	2026-03-21 16:57:58.980161-04	2	g	\N	0.25	f
flock_double_smash	Flock Double Smash Burger (w/ bun)	240	14	10	16	0.5	f	\N	restaurant	\N	2026-03-22 15:54:52.438565-04	2	g	\N	0.25	f
flock_wings_6pc	Flock Wings (6pc buffalo/soy ginger)	225	15	5	7.5	0	f	\N	restaurant	\N	2026-03-22 15:54:52.438565-04	2	g	\N	0.25	f
steamed_broccolini	Steamed Broccolini	35	4	7	0.4	3.3	f	\N	vegetable	\N	2026-03-22 15:54:52.438565-04	2	g	\N	0.25	f
flock_charcuterie_third	Charcuterie & Cheese Platter (1/3 share)	350	18	8	28	0.5	f	\N	restaurant	\N	2026-03-22 20:42:44.001585-04	2	g	\N	0.25	f
chocolate_mousse	Chocolate Mousse	195	3.5	22	10	1	f	\N	dessert	\N	2026-03-22 20:42:44.001585-04	2	g	\N	0.25	f
banana	Banana	89	1.1	22.8	0.3	2.6	f	\N	fruit	173944	2026-03-14 21:52:33.742045-04	1	pcs	118	0.25	f
green_apple	Green Apple (Granny Smith)	52	0.3	13.6	0.2	2.4	f	\N	fruit	\N	2026-03-25 17:11:18.515874-04	2	pcs	180	0.25	f
orange	Orange	47	0.9	11.8	0.1	2.4	f	\N	fruit	\N	2026-03-14 21:52:33.742045-04	1	pcs	130	0.25	f
lemon	Lemon	29	1.1	9.3	0.3	2.8	f	\N	fruit	\N	2026-03-20 16:46:06.506887-04	2	pcs	58	0.25	f
canned_tuna_water	Canned Albacore Tuna (water)	128	23.6	0	3	0	f	\N	protein	\N	2026-03-16 09:27:36.955873-04	3	can	125	1	f
rice_cakes	Rice Cakes	387	8	81.1	2.8	4.2	f	\N	carbs	\N	2026-03-20 16:46:06.506887-04	2	pcs	9	0.25	f
chipotle_fresh_salsa	Chipotle Fresh Tomato Salsa	6	0	1	0	0.5	f	\N	restaurant	\N	2026-03-28 09:09:58.106707-04	2	serving	400	0.25	f
chipotle_chicken	Chipotle Chicken	159	28.2	0	6.2	0	f	\N	restaurant	\N	2026-03-28 09:09:58.106707-04	2	serving	113	0.25	f
chipotle_lettuce	Chipotle Romaine Lettuce	14	1.4	2.8	0	1.4	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	71	0.25	f
chipotle_tortilla	Chipotle Flour Tortilla	267	6.7	41.7	7.5	2.5	f	\N	restaurant	\N	2026-03-28 09:09:58.106707-04	2	pcs	120	0.25	f
chipotle_black_beans	Chipotle Black Beans	115	7.1	19.5	1.3	6.2	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
chipotle_pinto_beans	Chipotle Pinto Beans	115	7.1	18.6	1.3	7.1	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
chipotle_steak	Chipotle Steak	132	18.5	0.9	5.3	0	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
chipotle_barbacoa	Chipotle Barbacoa	150	21.2	1.8	6.2	0.9	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
chipotle_carnitas	Chipotle Carnitas	185	20.3	0	10.6	0	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
chipotle_sofritas	Chipotle Sofritas	123	7	8.8	8.8	3.5	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	113	0.25	f
eggs_whole	Whole Egg (with yolk)	143	12.6	0.7	9.5	0	f	1	protein	171287	2026-03-14 21:52:33.742045-04	3	egg	50	1	f
egg_whites	Egg Whites (no yolk)	52	11	0.7	0.2	0	f	\N	protein	\N	2026-03-17 10:01:10.185513-04	3	egg	33	1	f
chipotle_cheese	Chipotle Cheese	353	28.2	0	30	0	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	28	0.25	f
chipotle_sour_cream	Chipotle Sour Cream	212	3.5	3.5	17.6	0	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	57	0.25	f
chipotle_guacamole	Chipotle Guacamole	151	2	8.1	13.1	6.1	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	99	0.25	f
chipotle_corn_salsa	Chipotle Roasted Corn Salsa	81	3	15.2	1.5	3	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	99	0.25	f
chipotle_green_salsa	Chipotle Green Tomatillo Salsa	26	1.8	5.3	0	1.8	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	57	0.25	f
chipotle_red_salsa	Chipotle Red Tomatillo Salsa	44	1.8	8.8	0.9	3.5	f	\N	restaurant	\N	2026-03-29 16:20:36.377211-04	2	serving	57	0.25	f
chia_seeds	Chia Seeds	486	17	42	31	34	f	\N	grain	\N	2026-03-31 18:02:34.8883-04	2	g	\N	0.25	f
cottage_cheese_2pct	Cottage Cheese 2%	86	12	4	2.3	0	f	\N	dairy	\N	2026-03-31 20:55:13.131888-04	2	g	\N	0.25	f
sweet_potato_raw	Sweet Potato (raw)	86	1.6	20	0.1	3	t	0.8	carbs	\N	2026-03-31 18:02:34.8883-04	2	g	\N	0.25	f
quinoa_dry	Quinoa (dry)	368	14	64	6	7	t	2.75	carbs	\N	2026-03-31 18:02:34.8883-04	2	g	\N	0.25	f
cod_raw	Cod Fish (raw)	82	18	0	0.7	0	t	0.8	protein	\N	2026-03-31 18:02:34.8883-04	2	g	\N	0.25	f
chicken_breast_raw	Chicken Breast (raw)	120	22.5	0	2.6	0	t	0.72	protein	171077	2026-03-14 21:52:33.742045-04	3	g	\N	0.25	t
\.


--
-- PostgreSQL database dump complete
--

