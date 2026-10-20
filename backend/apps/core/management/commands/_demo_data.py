"""Données de démonstration (catalogue Sira Yitte) utilisées par `manage.py seed_demo`."""

COLORS = {"Marron": "#7a4a2a", "Noir": "#221a15", "Beige": "#d6bc93", "Miel": "#c8893a", "Camel": "#b07a45", "Bordeaux": "#6b2a2a", "Gris": "#8d8a86"}

CATEGORIES = ["Homme", "Femme", "Traditionnelle", "Classique", "Premium"]

ZONES = [("Dakar", 2000), ("Pikine", 1500), ("Guédiawaye", 2000), ("Autre zone", None)]

# (nom, catégorie, prix, ancien prix, modèle, couleurs, description, popularité, rang, vedette, (taille min, taille max)[, photo])
PRODUCTS = [
    ['Sandale Traditionnelle Baobab','Traditionnelle',12000,15000,3,['Marron','Miel','Noir'],'Inspirée des motifs de nos grands-mères, cousue main avec de larges brides ornées de clous dorés.',95,1,1,[38,44]],
    ['Sandale Classique Dakar','Classique',15000,0,1,['Marron','Noir','Beige'],'La sandale de tous les jours : brides croisées, semelle souple et cuir qui se patine avec le temps.',88,2,1,[38,44]],
    ['Sandale Premium Teranga','Premium',20000,25000,1,['Noir','Camel','Marron'],'Cuir pleine fleur, doublure en cuir, couture renforcée et boucle dorée. Notre pièce signature.',100,3,1,[38,44]],
    ['Sandale Homme Sahel','Homme',17500,0,2,['Marron','Noir'],'Entre-doigt robuste pour homme, semelle épaisse adaptée à la marche quotidienne.',70,4,1,[40,45]],
    ['Sandale Femme Saly','Femme',14000,0,2,['Beige','Miel','Camel'],'Légère et élégante, parfaite pour l’été. Cuir doux, brides fines.',76,5,1,[36,41]],
    ['Sandale Femme Gorée','Femme',16500,19000,1,['Bordeaux','Beige','Camel'],'Brides croisées et reflets chauds, pour les journées comme pour les soirées.',64,6,0,[36,41]],
    ['Sandale Homme Saloum','Homme',18000,0,3,['Marron','Noir'],'Large bride clouté, maintien parfait et cuir épais pour durer des années.',58,7,0,[40,45]],
    ['Sandale Premium Lac Rose','Premium',22000,0,3,['Bordeaux','Noir'],'Cuir bordeaux profond, clous dorés et finitions main. Édition limitée.',82,8,0,[38,44]],
    ['Sandale Sahara Gris','Homme',24000,0,2,['Gris'],'Daim gris très doux, brides croisées en cuir gaufré à motifs floraux, anneau d\'orteil et semelle noire épaisse.',110,9,1,[40,45],'gris'],
    ['Sandale Soleil Bordeaux','Premium',28000,32000,1,['Bordeaux'],'Cuir bordeaux gaufré, nœud et franges dorées en forme de soleil. Notre pièce la plus précieuse, entièrement faite main.',105,10,1,[36,41],'rouge'],
]
